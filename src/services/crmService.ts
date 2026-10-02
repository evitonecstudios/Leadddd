import { db } from '../db/index';
import * as schema from '../db/schema';
import { eq, and } from 'drizzle-orm';

export type LeadStatus = 'NEW' | 'REVIEWED' | 'QUALIFIED' | 'CONTACTED' | 'REPLIED' | 'MEETING' | 'PROPOSAL' | 'NEGOTIATING' | 'WON' | 'LOST' | 'DISMISSED';

export class CRMService {
  static async logActivity(leadId: number, userId: number, type: string, description: string, origin: 'SYSTEM' | 'AI' | 'USER' | 'INTEGRATION' = 'SYSTEM', metadata?: any) {
    await db.insert(schema.activities).values({
      leadId,
      userId,
      type,
      description,
      origin,
      metadata
    });
  }

  static async updateStatus(leadId: number, userId: number, newStatus: LeadStatus, reason?: string) {
    const lead = await db.query.leads.findFirst({ where: eq(schema.leads.id, leadId) });
    if (!lead) throw new Error('Lead not found');

    const oldStatus = lead.leadStatus;
    if (oldStatus === newStatus) return;

    await db.update(schema.leads)
      .set({ leadStatus: newStatus, updatedAt: new Date() })
      .where(eq(schema.leads.id, leadId));

    await this.logActivity(
      leadId, 
      userId, 
      'STATUS_CHANGE', 
      `Status changed from ${oldStatus} to ${newStatus}${reason ? `: ${reason}` : ''}`,
      'USER',
      { oldStatus, newStatus, reason }
    );
  }

  static async addNote(leadId: number, userId: number, content: string) {
    const [note] = await db.insert(schema.notes).values({
      leadId,
      userId,
      content
    }).returning();

    await this.logActivity(leadId, userId, 'NOTE_ADDED', 'New note added', 'USER', { noteId: note.id });
    return note;
  }

  static async createTask(leadId: number, userId: number, data: { title: string; dueDate?: Date; priority?: 'LOW' | 'MEDIUM' | 'HIGH' }) {
    const [task] = await db.insert(schema.tasks).values({
      leadId,
      userId,
      title: data.title,
      dueDate: data.dueDate,
      priority: data.priority || 'MEDIUM',
      status: 'TODO'
    }).returning();

    await this.logActivity(leadId, userId, 'TASK_CREATED', `Task created: ${data.title}`, 'USER', { taskId: task.id });
    return task;
  }

  static async completeTask(taskId: number, userId: number) {
    const [task] = await db.update(schema.tasks)
      .set({ status: 'COMPLETED', updatedAt: new Date() })
      .where(and(eq(schema.tasks.id, taskId), eq(schema.tasks.userId, userId)))
      .returning();

    if (task) {
      await this.logActivity(task.leadId, userId, 'TASK_COMPLETED', `Task completed: ${task.title}`, 'USER', { taskId: task.id });
    }
    return task;
  }

  static async softDeleteLead(leadId: number, userId: number) {
    await db.update(schema.leads)
      .set({ deletedAt: new Date() })
      .where(eq(schema.leads.id, leadId));
    
    await this.logActivity(leadId, userId, 'LEAD_DELETED', 'Lead moved to trash', 'USER');
  }

  static async restoreLead(leadId: number, userId: number) {
    await db.update(schema.leads)
      .set({ deletedAt: null })
      .where(eq(schema.leads.id, leadId));
    
    await this.logActivity(leadId, userId, 'LEAD_RESTORED', 'Lead restored from trash', 'USER');
  }
}
