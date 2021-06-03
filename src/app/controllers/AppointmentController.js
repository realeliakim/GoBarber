import * as Yup from 'yup';
import { startOfHour, parseISO, isBefore, format, subHours } from 'date-fns';
import pt from 'date-fns/locale/pt-BR';
import User from '../models/User';
import File from '../models/File';
import Appointment from '../models/Appointment';
import Notification from '../schemas/Notification';

import Queue from '../../lib/Queue';
import CancellationMail from '../jobs/CancellationMail';



class AppointmentController {

  async index (req, res){
    const { page = 1 } = req.query;

    const appointment = await Appointment.findAll({
      where: { user_id: req.userId, canceled_at: null },
      order: ['date'],
      attributes: ['id', 'date', 'past', 'cancelable'],
      limit: 20,
      offset: (page - 1) * 20,
      include: [
        {
          model: User,
          as: 'provider',
          attributes: ['id', 'name'],
          include: [
            {
              model: File,
              as: 'avatar',
              attributes: ['id', 'path', 'url' ],
            }
          ]
        },
      ],
    });

    return res.json(appointment);
  }


  async store(req, res) {
    const schema = Yup.object().shape({
      provider_id: Yup.number().required(),
      date: Yup.date().required(),
    });

    if(!(await schema.isValid(req.body))){
      return res.status(400).json({ error: 'Validação falhou' });
    }

    const { provider_id, date } = req.body;

    /**
     * Verifica se provider_id é um provider
     */
    const isProvider = await User.findOne({
      where: { id: provider_id, provider: true },
    });

    if(!isProvider) {
      return res
        .status(401)
        .json({ error:  'Só é possível agendar para prestadores de serviço'});
    }

    if (provider_id === req.userId){
      return res.status(401).json({ error: 'Não é possível agendar para você mesmo'});
    }

    const hourStart = startOfHour(parseISO(date));

    if(isBefore(hourStart, new Date())){
      return res.status(400).json({ error: 'Datas passadas não são permitidas' });
    }

    /**
     * Verifica datas disponíveis
     */
    const checkAvailability = await Appointment.findOne({
      where: {
        provider_id,
        canceled_at: null,
        date: hourStart,
      },
    });

    if (checkAvailability) {
      return res.status(400).json({ error: 'Data para agendamento não está disponível' });
    }

    const appointment = await Appointment.create({
      user_id: req.userId,
      provider_id,
      date: hourStart,
    });

    /**
     * Notificar agendamento para prestador de serviço
     */
    const user = await User.findByPk(req.userId);
    const formattedDate = format(
      hourStart,
      "'dia' dd 'de' MMMM', às' H:mm'h'",
      { locale: pt }
    );

    await Notification.create({
      content: `Novo agendamento ${user.name} para ${formattedDate}`,
      user: provider_id,
    });

    return res.json(appointment);
  }


  async delete(req, res) {

    const appointment = await Appointment.findByPk(req.params.id, {
      include: [
        {
          model: User,
          as: 'provider',
          attributes: ['name', 'email'],
        },
        {
          model: User,
          as: 'user',
          attributes: ['name'],
        }
      ]
    });

    if (appointment.user_id !== req.userId){
      return res.status(401).json({
        error: "Você não tem permissão para cancelar esse agendamento."
      });
    }

    const dateWithSub = subHours(appointment.date, 2);

    if (isBefore(dateWithSub, new Date())){
      return res.status(401).json({
        error: "Horário limite cancelamento 2 horas antes da hora marcada."
      });
    }

    appointment.canceled_at = new Date();

    await appointment.save();

    await Queue.add(CancellationMail.key, {
      appointment,
    });

    return res.json(appointment);
  }
}

export default new AppointmentController();
