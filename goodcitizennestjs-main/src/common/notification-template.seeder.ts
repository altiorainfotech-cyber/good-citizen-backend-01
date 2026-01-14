import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  NotificationTemplate,
  NotificationTemplateDocument,
} from '../entities/notification-template.entity';
import {
  NotificationType,
  NotificationPriority,
} from '../entities/notification.entity';

@Injectable()
export class NotificationTemplateSeeder implements OnModuleInit {
  constructor(
    @InjectModel(NotificationTemplate.name)
    private notificationTemplateModel: Model<NotificationTemplateDocument>,
  ) {}

  async onModuleInit() {
    await this.seedTemplates();
  }

  private async seedTemplates() {
    const templates = [
      {
        template_key: 'ride_assigned',
        type: NotificationType.DRIVER_ASSIGNED,
        priority: NotificationPriority.HIGH,
        localized_content: new Map([
          [
            'en',
            {
              title: 'Driver Assigned',
              message:
                'Your driver {{driver_name}} is on the way! Vehicle: {{vehicle_plate}}',
              push_title: 'Driver Assigned',
              push_message: '{{driver_name}} is coming to pick you up',
              email_subject: 'Your ride is confirmed - Driver assigned',
              email_body:
                'Hello! Your driver {{driver_name}} has been assigned and is on the way to pick you up. Vehicle details: {{vehicle_plate}}. Estimated arrival: {{estimated_time}} minutes.',
              sms_message:
                'Driver {{driver_name}} assigned. Vehicle: {{vehicle_plate}}. ETA: {{estimated_time}} min.',
            },
          ],
          [
            'es',
            {
              title: 'Conductor Asignado',
              message:
                'Tu conductor {{driver_name}} está en camino! Vehículo: {{vehicle_plate}}',
              push_title: 'Conductor Asignado',
              push_message: '{{driver_name}} viene a recogerte',
              email_subject: 'Tu viaje está confirmado - Conductor asignado',
              email_body:
                '¡Hola! Tu conductor {{driver_name}} ha sido asignado y está en camino para recogerte. Detalles del vehículo: {{vehicle_plate}}. Llegada estimada: {{estimated_time}} minutos.',
              sms_message:
                'Conductor {{driver_name}} asignado. Vehículo: {{vehicle_plate}}. ETA: {{estimated_time}} min.',
            },
          ],
        ]),
        variables: ['driver_name', 'vehicle_plate', 'estimated_time'],
      },
      {
        template_key: 'emergency_alert',
        type: NotificationType.EMERGENCY_ALERT,
        priority: NotificationPriority.EMERGENCY,
        localized_content: new Map([
          [
            'en',
            {
              title: 'Emergency Vehicle Approaching',
              message:
                'Emergency vehicle {{ambulance_num}} approaching in {{estimated_time}} seconds. Please clear the path.',
              push_title: '🚨 Emergency Alert',
              push_message:
                'Ambulance {{ambulance_num}} approaching - Clear the path!',
              email_subject: 'Emergency Vehicle Alert',
              email_body:
                'An emergency vehicle ({{ambulance_num}}) is approaching your location. Please move to the side to allow safe passage. Estimated arrival: {{estimated_time}} seconds.',
              sms_message:
                'EMERGENCY: Ambulance {{ambulance_num}} approaching in {{estimated_time}}s. Clear path!',
            },
          ],
          [
            'es',
            {
              title: 'Vehículo de Emergencia Acercándose',
              message:
                'Vehículo de emergencia {{ambulance_num}} acercándose en {{estimated_time}} segundos. Por favor despeje el camino.',
              push_title: '🚨 Alerta de Emergencia',
              push_message:
                'Ambulancia {{ambulance_num}} acercándose - ¡Despeje el camino!',
              email_subject: 'Alerta de Vehículo de Emergencia',
              email_body:
                'Un vehículo de emergencia ({{ambulance_num}}) se está acercando a su ubicación. Por favor muévase a un lado para permitir el paso seguro. Llegada estimada: {{estimated_time}} segundos.',
              sms_message:
                'EMERGENCIA: Ambulancia {{ambulance_num}} acercándose en {{estimated_time}}s. ¡Despeje el camino!',
            },
          ],
        ]),
        variables: ['ambulance_num', 'estimated_time'],
      },
      {
        template_key: 'ride_completed',
        type: NotificationType.RIDE_COMPLETED,
        priority: NotificationPriority.NORMAL,
        localized_content: new Map([
          [
            'en',
            {
              title: 'Ride Completed',
              message:
                'Your ride has been completed. Total fare: ${{final_fare}}. Thank you for using our service!',
              push_title: 'Trip Complete',
              push_message: 'Thanks for riding with us! Fare: ${{final_fare}}',
              email_subject: 'Ride Receipt - Trip Completed',
              email_body:
                'Thank you for your ride! Your trip has been completed successfully. Total fare: ${{final_fare}}. We hope you had a pleasant journey and look forward to serving you again.',
              sms_message:
                'Ride completed. Fare: ${{final_fare}}. Thanks for choosing us!',
            },
          ],
          [
            'es',
            {
              title: 'Viaje Completado',
              message:
                'Su viaje ha sido completado. Tarifa total: ${{final_fare}}. ¡Gracias por usar nuestro servicio!',
              push_title: 'Viaje Completo',
              push_message:
                '¡Gracias por viajar con nosotros! Tarifa: ${{final_fare}}',
              email_subject: 'Recibo de Viaje - Viaje Completado',
              email_body:
                '¡Gracias por su viaje! Su viaje ha sido completado exitosamente. Tarifa total: ${{final_fare}}. Esperamos que haya tenido un viaje placentero y esperamos servirle nuevamente.',
              sms_message:
                'Viaje completado. Tarifa: ${{final_fare}}. ¡Gracias por elegirnos!',
            },
          ],
        ]),
        variables: ['final_fare'],
      },
      {
        template_key: 'ride_update',
        type: NotificationType.RIDE_UPDATE,
        priority: NotificationPriority.NORMAL,
        localized_content: new Map([
          [
            'en',
            {
              title: 'Ride Status Update',
              message: 'Your ride status has been updated to: {{ride_status}}',
              push_title: 'Ride Update',
              push_message: 'Status: {{ride_status}}',
              email_subject: 'Ride Status Update',
              email_body:
                'Your ride status has been updated. Current status: {{ride_status}}. We will keep you informed of any further updates.',
              sms_message: 'Ride status: {{ride_status}}',
            },
          ],
          [
            'es',
            {
              title: 'Actualización del Estado del Viaje',
              message:
                'El estado de su viaje ha sido actualizado a: {{ride_status}}',
              push_title: 'Actualización de Viaje',
              push_message: 'Estado: {{ride_status}}',
              email_subject: 'Actualización del Estado del Viaje',
              email_body:
                'El estado de su viaje ha sido actualizado. Estado actual: {{ride_status}}. Le mantendremos informado de cualquier actualización adicional.',
              sms_message: 'Estado del viaje: {{ride_status}}',
            },
          ],
        ]),
        variables: ['ride_status'],
      },
      {
        template_key: 'system_announcement',
        type: NotificationType.SYSTEM_ANNOUNCEMENT,
        priority: NotificationPriority.LOW,
        localized_content: new Map([
          [
            'en',
            {
              title: 'System Announcement',
              message: '{{announcement_message}}',
              push_title: 'Announcement',
              push_message: '{{announcement_message}}',
              email_subject: 'Important Announcement',
              email_body:
                'We have an important announcement: {{announcement_message}}',
              sms_message: 'Announcement: {{announcement_message}}',
            },
          ],
          [
            'es',
            {
              title: 'Anuncio del Sistema',
              message: '{{announcement_message}}',
              push_title: 'Anuncio',
              push_message: '{{announcement_message}}',
              email_subject: 'Anuncio Importante',
              email_body:
                'Tenemos un anuncio importante: {{announcement_message}}',
              sms_message: 'Anuncio: {{announcement_message}}',
            },
          ],
        ]),
        variables: ['announcement_message'],
      },
    ];

    for (const template of templates) {
      const existingTemplate = await this.notificationTemplateModel.findOne({
        template_key: template.template_key,
      });

      if (!existingTemplate) {
        await this.notificationTemplateModel.create({
          ...template,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        });
// console.log removed
      }
    }
  }
}
