export type Priority = 'low' | 'medium' | 'high' | 'urgent';
export type Category = 'Trabajo' | 'Personal' | 'Estudio' | 'Salud' | 'Finanzas';
export type TaskStatus = 'backlog' | 'scheduled' | 'completed' | 'discarded';

export interface TaskItem {
  id: string;
  title: string;
  description?: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  durationMinutes: number;
  reminderMinutes: number;
  priority: Priority;
  category: Category;
  status: TaskStatus;
  completed: boolean;
  notionPageId?: string;
  googleEventId?: string;
}

export interface SyncSettings {
  googleCalendarConnected: boolean;
  notionConnected: boolean;
  notionDatabaseId: string;
  autoSyncVoice: boolean;
  soundEnabled: boolean;
}
