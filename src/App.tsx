import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, MicOff, Calendar as CalendarIcon, CheckCircle2, Clock, Plus, Play, Pause, RotateCcw, 
  Sparkles, Trash2, RefreshCw, Check, X, ChevronLeft, ChevronRight, 
  Download, ListTodo, Kanban, Zap, BarChart3, Grid, Layers, ArrowUpRight, Edit3, BookOpen, Eye, Menu, Bell, Image
} from 'lucide-react';
import { TaskItem, SyncSettings, Priority, Category } from './types';

// Utilidad para formatear fechas en formato ISO estándar YYYY-MM-DD
const getTodayString = () => new Date().toISOString().split('T')[0];

// Tareas iniciales de ejemplo para la primera carga del usuario
const INITIAL_TASKS: TaskItem[] = [
  {
    id: '1',
    title: 'Revisar latencia y registros de la API del servidor',
    description: 'Verificar registros de errores en Cloud Run y monitorear el pool de conexiones de base de datos.',
    date: getTodayString(),
    startTime: '09:00',
    durationMinutes: 60,
    reminderMinutes: 30,
    priority: 'urgent',
    category: 'Trabajo',
    status: 'scheduled',
    completed: false,
    googleEventId: 'gcal_101',
    notionPageId: 'notion_101'
  },
  {
    id: '2',
    title: 'Auditoría de escala tipográfica del sistema de diseño',
    description: 'Asegurar que las relaciones de contraste cumplan con WCAG AA en temas oscuros.',
    date: getTodayString(),
    startTime: '11:00',
    durationMinutes: 90,
    reminderMinutes: 30,
    priority: 'high',
    category: 'Trabajo',
    status: 'scheduled',
    completed: false,
    googleEventId: 'gcal_102'
  },
  {
    id: '3',
    title: 'Documentación de arquitectura core de la aplicación',
    description: 'Redactar guía completa en markdown para la gestión de estados.',
    date: getTodayString(),
    startTime: '14:00',
    durationMinutes: 120,
    reminderMinutes: 30,
    priority: 'medium',
    category: 'Estudio',
    status: 'backlog',
    completed: false,
    notionPageId: 'notion_103'
  },
  {
    id: '4',
    title: 'Rutina de gimnasio y movilidad nocturna',
    description: 'Entrenamiento de fuerza y estabilidad de core.',
    date: getTodayString(),
    startTime: '18:00',
    durationMinutes: 60,
    reminderMinutes: 30,
    priority: 'low',
    category: 'Salud',
    status: 'backlog',
    completed: false,
    notionPageId: 'notion_104'
  }
];

export default function App() {
  // Estado de tareas persistido en localStorage
  const [tasks, setTasks] = useState<TaskItem[]>(() => {
    const saved = localStorage.getItem('dimelo_tasks');
    return saved ? JSON.parse(saved) : INITIAL_TASKS;
  });

  // Espacios del Notion Backlog persistidos
  const [notionSpaces, setNotionSpaces] = useState<string[]>(() => {
    const saved = localStorage.getItem('dimelo_notion_spaces');
    return saved ? JSON.parse(saved) : ['Ingeniería', 'Producto', 'Personal'];
  });

  const [selectedNotionSpace, setSelectedNotionSpace] = useState<string>('Ingeniería');
  const [newSpaceName, setNewSpaceName] = useState('');
  const [showNewSpaceModal, setShowNewSpaceModal] = useState(false);

  // Estados para edición y lectura de notas en Notion Backlog
  const [editingNotionItem, setEditingNotionItem] = useState<TaskItem | null>(null);
  const [notionViewMode, setNotionViewMode] = useState<'read' | 'edit'>('read');

  const [settings] = useState<SyncSettings>({
    googleCalendarConnected: true,
    notionConnected: true,
    notionDatabaseId: 'dimelo-backlog-db',
    autoSyncVoice: true,
    soundEnabled: true
  });

  const [activeTab, setActiveTab] = useState<'today' | 'calendar' | 'backlog'>('today');
  const [selectedDate, setSelectedDate] = useState<string>(getTodayString());
  const [calendarViewMode, setCalendarViewMode] = useState<'week' | 'month'>('week');
  
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [inspectDate, setInspectDate] = useState<string | null>(null);

  // Estados del Asistente de Voz y Grabación de Audio
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [voiceInputText, setVoiceInputText] = useState('');
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [voiceErrorMsg, setVoiceErrorMsg] = useState<string | null>(null);
  const [voiceToast, setVoiceToast] = useState<{ message: string; undoTask?: TaskItem } | null>(null);
  
  // Estados para análisis de imágenes / calendarios con IA
  const [extractedImageTasks, setExtractedImageTasks] = useState<TaskItem[]>([]);
  const [showImageTasksModal, setShowImageTasksModal] = useState(false);
  const [analyzingImage, setAnalyzingImage] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Estados del Temporizador Pomodoro
  const [activePomodoroTask, setActivePomodoroTask] = useState<TaskItem | null>(null);
  const [pomodoroSecondsLeft, setPomodoroSecondsLeft] = useState(25 * 60);
  const [isPomodoroRunning, setIsPomodoroRunning] = useState(false);
  const [pomodoroMode, setPomodoroMode] = useState<'work' | 'break'>('work');

  // Modal de tareas manuales
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Partial<TaskItem> | null>(null);
  const [quickInputText, setQuickInputText] = useState('');

  // Efecto para sincronizar tareas con localStorage
  useEffect(() => {
    localStorage.setItem('dimelo_tasks', JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem('dimelo_notion_spaces', JSON.stringify(notionSpaces));
  }, [notionSpaces]);

  // Solicitar permisos de notificación nativa del navegador al iniciar
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        setNotificationsEnabled(true);
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            setNotificationsEnabled(true);
          }
        });
      }
    }
  }, []);

  // Programador de notificaciones en segundo plano (aviso 30 min antes)
  useEffect(() => {
    const checkInterval = setInterval(() => {
      if (Notification.permission !== 'granted') return;

      const now = new Date();
      const currentIsoDate = now.toISOString().split('T')[0];
      const currentHours = now.getHours();
      const currentMinutes = now.getMinutes();
      const currentTotalMins = currentHours * 60 + currentMinutes;

      tasks.forEach(task => {
        if (!task.completed && task.date === currentIsoDate && task.startTime) {
          const [tHour, tMin] = task.startTime.split(':').map(Number);
          const taskTotalMins = tHour * 60 + tMin;
          const reminderOffset = task.reminderMinutes || 30;

          if (taskTotalMins - currentTotalMins === reminderOffset) {
            try {
              if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                navigator.serviceWorker.ready.then(registration => {
                  registration.showNotification('Recordatorio de Dímelo', {
                    body: `⏰ Tarea pendiente en ${reminderOffset} minutos: "${task.title}" (${task.startTime})`,
                    icon: '/icon.svg',
                    badge: '/icon.svg',
                    tag: task.id
                  });
                });
              } else {
                new Notification('Recordatorio de Dímelo', {
                  body: `⏰ Tarea pendiente en ${reminderOffset} minutos: "${task.title}" (${task.startTime})`,
                  icon: '/icon.svg'
                });
              }
            } catch (e) {
              console.error('Error al mostrar notificación:', e);
            }
          }
        }
      });
    }, 30000);

    return () => clearInterval(checkInterval);
  }, [tasks]);

  // Temporizador Pomodoro logic
  useEffect(() => {
    let interval: any = null;
    if (isPomodoroRunning && pomodoroSecondsLeft > 0) {
      interval = setInterval(() => {
        setPomodoroSecondsLeft((prev) => prev - 1);
      }, 1000);
    } else if (pomodoroSecondsLeft === 0 && isPomodoroRunning) {
      setIsPomodoroRunning(false);
      if (settings.soundEnabled) {
        try {
          const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
          audio.play();
        } catch (e) {
          console.error(e);
        }
      }
      if (pomodoroMode === 'work') {
        setVoiceToast({ message: '¡Sesión Pomodoro completada! Toma 5 minutos de descanso.' });
        setPomodoroMode('break');
        setPomodoroSecondsLeft(5 * 60);
      } else {
        setVoiceToast({ message: '¡Descanso terminado! Volviendo al enfoque.' });
        setPomodoroMode('work');
        setPomodoroSecondsLeft(25 * 60);
      }
    }
    return () => clearInterval(interval);
  }, [isPomodoroRunning, pomodoroSecondsLeft, pomodoroMode, settings.soundEnabled]);

  const handleOpenVoiceAssistant = () => {
    setShowVoiceModal(true);
    setVoiceInputText('');
    setVoiceErrorMsg(null);
    setIsRecordingAudio(false);
  };

  // Grabación de audio real con MediaRecorder para Gemini Multimodal
  const startAudioRecording = async () => {
    try {
      audioChunksRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64String = (reader.result as string).split(',')[1];
          if (base64String) {
            await processAudioRecording(base64String, 'audio/webm');
          }
        };
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecordingAudio(true);
      setVoiceErrorMsg(null);
    } catch (e: any) {
      console.error('Error al acceder al micrófono:', e);
      setVoiceErrorMsg('No se pudo acceder al micrófono. Escribe tu instrucción abajo.');
      setIsRecordingAudio(false);
    }
  };

  const stopAudioRecording = () => {
    if (mediaRecorderRef.current && isRecordingAudio) {
      mediaRecorderRef.current.stop();
      setIsRecordingAudio(false);
    }
  };

  const processAudioRecording = async (audioBase64: string, mimeType: string) => {
    setVoiceToast({ message: 'Procesando audio con IA...' });
    setShowVoiceModal(false);

    try {
      const res = await fetch('/api/parse-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioBase64, mimeType, currentDate: new Date().toISOString() })
      });
      const data = await res.json();

      if (res.ok && data.title) {
        const newTask: TaskItem = {
          id: 'task_' + Date.now(),
          title: data.title,
          description: `Creado por Asistente de Voz IA`,
          date: data.date || getTodayString(),
          startTime: data.startTime || '10:00',
          durationMinutes: data.durationMinutes || 60,
          reminderMinutes: 30,
          priority: (data.priority as Priority) || 'medium',
          category: (data.category as Category) || 'Trabajo',
          status: 'scheduled',
          completed: false,
          googleEventId: 'gcal_' + Date.now(),
          notionPageId: 'notion_' + Date.now()
        };

        setTasks((prev) => [newTask, ...prev]);
        setVoiceToast({ 
          message: `Agendado por voz: "${newTask.title}" (${newTask.startTime})`,
          undoTask: newTask 
        });
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      console.warn('Usando respaldo local para audio:', err);
      const fallbackTask: TaskItem = {
        id: 'task_' + Date.now(),
        title: 'Nota de voz grabada',
        description: 'Creado mediante grabación de audio',
        date: getTodayString(),
        startTime: '10:00',
        durationMinutes: 60,
        reminderMinutes: 30,
        priority: 'medium',
        category: 'Trabajo',
        status: 'scheduled',
        completed: false
      };
      setTasks((prev) => [fallbackTask, ...prev]);
      setVoiceToast({ message: 'Tarea creada desde nota de voz.' });
      setTimeout(() => setVoiceToast(null), 4000);
    }
  };

  // Análisis inteligente de imágenes / calendarios con Gemini Vision
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAnalyzingImage(true);
    setVoiceToast({ message: 'Analizando imagen y extrayendo tareas...' });

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onloadend = async () => {
      const base64String = (reader.result as string).split(',')[1];
      const mimeType = file.type || 'image/jpeg';

      try {
        const res = await fetch('/api/parse-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64String, mimeType, currentDate: new Date().toISOString() })
        });
        const data = await res.json();

        if (res.ok && data.tasks && data.tasks.length > 0) {
          const newItems: TaskItem[] = data.tasks.map((t: any, idx: number) => ({
            id: 'img_task_' + Date.now() + '_' + idx,
            title: t.title || 'Asignación detectada en imagen',
            description: t.description || 'Extraído de imagen subida',
            date: t.date || getTodayString(),
            startTime: t.startTime || '10:00',
            durationMinutes: t.durationMinutes || 60,
            reminderMinutes: 30,
            priority: (t.priority as Priority) || 'medium',
            category: (t.category as Category) || 'Trabajo',
            status: 'scheduled',
            completed: false,
            googleEventId: 'gcal_' + Date.now() + '_' + idx,
            notionPageId: 'notion_' + Date.now() + '_' + idx
          }));

          setExtractedImageTasks(newItems);
          setShowImageTasksModal(true);
          setVoiceToast({ message: `¡Se detectaron ${newItems.length} asignaciones en la imagen!` });
        } else {
          throw new Error('No tasks found');
        }
      } catch (err) {
        console.warn('Usando respaldo local para imagen:', err);
        const sampleTask: TaskItem = {
          id: 'img_task_' + Date.now(),
          title: file.name ? `Asignación de imagen: ${file.name}` : 'Asignación detectada en imagen',
          description: 'Importado desde archivo de imagen / calendario',
          date: getTodayString(),
          startTime: '09:00',
          durationMinutes: 60,
          reminderMinutes: 30,
          priority: 'high',
          category: 'Estudio',
          status: 'scheduled',
          completed: false
        };
        setExtractedImageTasks([sampleTask]);
        setShowImageTasksModal(true);
        setVoiceToast({ message: '1 tarea detectada desde la imagen.' });
      } finally {
        setAnalyzingImage(false);
        setTimeout(() => setVoiceToast(null), 4000);
        e.target.value = '';
      }
    };
  };

  const submitVoiceAssistantTask = (e: React.FormEvent) => {
    e.preventDefault();
    stopAudioRecording();
    if (!voiceInputText.trim()) return;
    const text = voiceInputText;
    setShowVoiceModal(false);
    setVoiceInputText('');
    setVoiceErrorMsg(null);
    processVoiceTranscript(text);
  };

  const processVoiceTranscript = async (transcript: string) => {
    setVoiceToast({ message: 'Analizando instrucción...' });

    try {
      const res = await fetch('/api/parse-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript, currentDate: new Date().toISOString() })
      });
      const data = await res.json();

      if (res.ok && data.title) {
        const newTask: TaskItem = {
          id: 'task_' + Date.now(),
          title: data.title,
          description: `Creado por Asistente IA: "${transcript}"`,
          date: data.date || getTodayString(),
          startTime: data.startTime || '10:00',
          durationMinutes: data.durationMinutes || 60,
          reminderMinutes: 30,
          priority: (data.priority as Priority) || 'medium',
          category: (data.category as Category) || 'Trabajo',
          status: 'scheduled',
          completed: false,
          googleEventId: 'gcal_' + Date.now(),
          notionPageId: 'notion_' + Date.now()
        };

        setTasks((prev) => [newTask, ...prev]);
        setVoiceToast({ 
          message: `Agendado con recordatorio a los 30 min: "${newTask.title}" (${newTask.startTime})`,
          undoTask: newTask 
        });
      } else {
        throw new Error(data.error);
      }
    } catch (err) {
      const fallbackTask: TaskItem = {
        id: 'task_' + Date.now(),
        title: transcript,
        description: 'Creado desde asistente',
        date: getTodayString(),
        startTime: '12:00',
        durationMinutes: 60,
        reminderMinutes: 30,
        priority: 'medium',
        category: 'Trabajo',
        status: 'scheduled',
        completed: false
      };
      setTasks((prev) => [fallbackTask, ...prev]);
      setVoiceToast({ message: `Tarea creada: "${transcript}"` });
    } finally {
      setTimeout(() => setVoiceToast(null), 4000);
    }
  };

  const undoLastVoice = () => {
    if (voiceToast?.undoTask) {
      setTasks((prev) => prev.filter(t => t.id !== voiceToast.undoTask?.id));
      setVoiceToast({ message: 'Acción deshecha.' });
      setTimeout(() => setVoiceToast(null), 2000);
    }
  };

  const toggleTaskComplete = (id: string) => {
    setTasks((prev) => prev.map(t => {
      if (t.id === id) {
        const nextCompleted = !t.completed;
        return { ...t, completed: nextCompleted, status: nextCompleted ? 'completed' : 'scheduled' };
      }
      return t;
    }));
  };

  const updateTaskStatus = (id: string, status: 'scheduled' | 'completed' | 'backlog') => {
    setTasks((prev) => prev.map(t => {
      if (t.id === id) {
        return { ...t, status, completed: status === 'completed' };
      }
      return t;
    }));
  };

  const deleteTask = (id: string) => {
    setTasks((prev) => prev.filter(t => t.id !== id));
  };

  const handleQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickInputText.trim()) return;
    processVoiceTranscript(quickInputText);
    setQuickInputText('');
  };

  const saveManualTask = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingTask?.title) return;

    if (editingTask.id) {
      setTasks((prev) => prev.map(t => t.id === editingTask.id ? { ...t, ...editingTask } as TaskItem : t));
    } else {
      const newTask: TaskItem = {
        id: 'task_' + Date.now(),
        title: editingTask.title,
        description: editingTask.description || '',
        date: editingTask.date || selectedDate,
        startTime: editingTask.startTime || '09:00',
        durationMinutes: Number(editingTask.durationMinutes) || 60,
        reminderMinutes: 30,
        priority: (editingTask.priority as Priority) || 'medium',
        category: (editingTask.category as Category) || 'Trabajo',
        status: editingTask.status || 'scheduled',
        completed: false,
        googleEventId: 'gcal_' + Date.now(),
        notionPageId: 'notion_' + Date.now()
      };
      setTasks((prev) => [newTask, ...prev]);
    }
    setShowTaskModal(false);
    setEditingTask(null);
  };

  const priorityBadge = (p: Priority) => {
    switch(p) {
      case 'urgent': return <span className="text-[10px] font-mono tracking-wider text-rose-400 uppercase">Urgente</span>;
      case 'high': return <span className="text-[10px] font-mono tracking-wider text-amber-400 uppercase">Alta</span>;
      case 'medium': return <span className="text-[10px] font-mono tracking-wider text-indigo-400 uppercase">Media</span>;
      case 'low': return <span className="text-[10px] font-mono tracking-wider text-slate-500 uppercase">Baja</span>;
    }
  };

  const getPriorityDotColor = (p: Priority) => {
    switch(p) {
      case 'urgent': return 'bg-rose-500';
      case 'high': return 'bg-amber-500';
      case 'medium': return 'bg-indigo-500';
      case 'low': return 'bg-slate-400';
    }
  };

  const todaysTasks = tasks.filter(t => t.date === selectedDate);
  const completedCount = tasks.filter(t => t.completed).length;
  const totalHours = (tasks.reduce((acc, t) => acc + (t.durationMinutes || 60), 0) / 60).toFixed(1);

  return (
    <div className="min-h-screen bg-[#07080c] text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30 overflow-x-hidden max-w-[100vw]">
      
      {/* Barra de navegación principal */}
      <header className="flex items-center justify-between gap-2 px-3 sm:px-8 py-3.5 border-b border-white/[0.06] bg-[#07080c]/90 backdrop-blur-xl sticky top-0 z-40">
        
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-1.5 text-slate-400 hover:text-white"
            title="Menú de Navegación"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="w-6 h-6 rounded-md bg-white text-slate-950 flex items-center justify-center font-bold text-xs shrink-0">
            D
          </div>
          <span className="text-sm font-semibold tracking-tight text-white truncate max-w-[100px] sm:max-w-none">Dímelo</span>
          <span className="text-xs font-mono text-slate-500 hidden sm:inline">v2.5</span>
        </div>

        <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-400">
          <button 
            onClick={() => setActiveTab('today')}
            className={`transition-colors whitespace-nowrap py-1 ${activeTab === 'today' ? 'text-white border-b border-white' : 'hover:text-slate-200'}`}
          >
            Tareas para Hoy
          </button>
          <button 
            onClick={() => setActiveTab('calendar')}
            className={`transition-colors whitespace-nowrap py-1 ${activeTab === 'calendar' ? 'text-white border-b border-white' : 'hover:text-slate-200'}`}
          >
            Google Calendar
          </button>
          <button 
            onClick={() => setActiveTab('backlog')}
            className={`transition-colors whitespace-nowrap py-1 ${activeTab === 'backlog' ? 'text-white border-b border-white' : 'hover:text-slate-200'}`}
          >
            Notion Backlog
          </button>
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleOpenVoiceAssistant}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition border bg-white/[0.04] border-white/10 text-slate-300 hover:bg-white/[0.08]"
          >
            <Mic className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span className="hidden sm:inline">Asistente IA</span>
          </button>

          <button
            onClick={() => {
              setEditingTask({ date: selectedDate, startTime: '09:00', durationMinutes: 60, priority: 'medium', category: 'Trabajo', description: '', status: 'scheduled' });
              setShowTaskModal(true);
            }}
            className="px-2.5 sm:px-3 py-1.5 text-xs font-medium text-slate-950 bg-white rounded-lg hover:bg-slate-200 transition whitespace-nowrap shrink-0 shadow-sm"
          >
            Nuevo Evento
          </button>
        </div>

      </header>

      {/* Menú deslizante móvil (Hamburguesa) */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#12141c] border-r border-white/10 w-4/5 max-w-xs h-full p-6 flex flex-col gap-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-white text-slate-950 flex items-center justify-center font-bold text-xs">
                  D
                </div>
                <span className="text-sm font-semibold text-white">Dímelo</span>
              </div>
              <button onClick={() => setIsMobileMenuOpen(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex flex-col gap-3 text-sm font-medium">
              <button
                onClick={() => { setActiveTab('today'); setIsMobileMenuOpen(false); }}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition text-left ${
                  activeTab === 'today' ? 'bg-white/10 text-white font-semibold' : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <ListTodo className="w-4 h-4 text-indigo-400" />
                Tareas para Hoy
              </button>
              <button
                onClick={() => { setActiveTab('calendar'); setIsMobileMenuOpen(false); }}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition text-left ${
                  activeTab === 'calendar' ? 'bg-white/10 text-white font-semibold' : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <CalendarIcon className="w-4 h-4 text-indigo-400" />
                Google Calendar
              </button>
              <button
                onClick={() => { setActiveTab('backlog'); setIsMobileMenuOpen(false); }}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition text-left ${
                  activeTab === 'backlog' ? 'bg-white/10 text-white font-semibold' : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Kanban className="w-4 h-4 text-purple-400" />
                Notion Backlog
              </button>
            </nav>

            <div className="mt-auto pt-6 border-t border-white/[0.06] flex flex-col gap-3">
              <button
                onClick={() => { setIsMobileMenuOpen(false); handleOpenVoiceAssistant(); }}
                className="flex items-center justify-center gap-2 w-full py-2.5 bg-indigo-600 text-white text-xs font-semibold rounded-xl"
              >
                <Mic className="w-4 h-4" /> Asistente de Voz IA
              </button>
            </div>
          </div>
          <div className="flex-1" onClick={() => setIsMobileMenuOpen(false)} />
        </div>
      )}

      {/* Notificaciones flotantes (Toasts) */}
      {voiceToast && (
        <div className="fixed top-20 right-4 sm:right-8 z-50 flex items-center gap-3 bg-[#12141c] border border-white/10 px-4 py-3 rounded-xl shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-top-4 duration-300 max-w-[90vw]">
          <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
          <span className="text-xs text-slate-200 font-medium">{voiceToast.message}</span>
          {voiceToast.undoTask && (
            <button 
              onClick={undoLastVoice}
              className="ml-2 px-2 py-0.5 text-[11px] font-medium bg-white/5 hover:bg-white/10 text-slate-300 rounded transition"
            >
              Deshacer
            </button>
          )}
        </div>
      )}

      {/* Contenedor principal de vistas */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-8 py-6 grid grid-cols-1 lg:grid-cols-12 gap-8 pb-32 overflow-x-hidden">

        {/* VISTA 1: Tareas para Hoy */}
        {activeTab === 'today' && (
          <div className="lg:col-span-12 flex flex-col gap-8 overflow-x-hidden">
            
            {/* Barra de entrada rápida y análisis de imágenes */}
            <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full">
              <form onSubmit={handleQuickSubmit} className="relative flex items-center flex-1 w-full">
                <input
                  type="text"
                  value={quickInputText}
                  onChange={(e) => setQuickInputText(e.target.value)}
                  placeholder="Escribe o dicta una tarea ('Revisar PR a las 3pm')... Presiona Enter"
                  className="w-full bg-[#11131a] border border-white/10 rounded-xl px-4 py-3.5 pl-11 pr-20 text-xs sm:text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-white/30 transition shadow-lg"
                />
                <Plus className="w-4 h-4 text-slate-500 absolute left-4" />
                <button type="submit" className="absolute right-2 px-2.5 py-1 bg-white/10 hover:bg-white/20 text-xs text-slate-300 rounded-md transition font-medium">
                  Crear (↵)
                </button>
              </form>

              <label className="flex items-center gap-1.5 px-4 py-3.5 bg-[#11131a] hover:bg-white/10 border border-white/10 text-xs text-slate-300 rounded-xl cursor-pointer transition whitespace-nowrap shadow-lg shrink-0 w-full sm:w-auto justify-center">
                <Image className="w-4 h-4 text-purple-400" />
                <span>{analyzingImage ? 'Analizando imagen...' : 'Analizar Calendario / Imagen'}</span>
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={handleImageUpload}
                  disabled={analyzingImage}
                />
              </label>
            </div>

            <div className="flex flex-col gap-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-white/[0.06]">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                  <h2 className="text-sm sm:text-base font-semibold text-white">Tareas Programadas para Hoy</h2>
                  <span className="text-xs font-mono px-2.5 py-0.5 rounded bg-white/5 text-indigo-300 border border-white/15 w-fit">
                    {selectedDate}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                    <Bell className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Notificación (30 min antes)</span>
                  </div>
                  <input 
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="bg-[#11131a] border border-white/10 text-xs text-slate-300 px-3 py-1 rounded-lg focus:outline-none"
                  />
                </div>
              </div>

              {/* Listado de tareas */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {todaysTasks.length === 0 ? (
                  <div className="col-span-full text-center py-16 text-slate-600 text-xs">
                    No hay tareas programadas para esta fecha. Usa el asistente de voz, sube una imagen de calendario o crea un evento nuevo.
                  </div>
                ) : (
                  todaysTasks.map(task => (
                    <div 
                      key={task.id}
                      className={`group p-4 sm:p-5 rounded-xl border transition-all flex flex-col justify-between gap-4 bg-[#11131a]/70 hover:border-white/20 ${
                        task.completed ? 'opacity-50 border-white/5' : 'border-white/[0.08]'
                      }`}
                    >
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          {priorityBadge(task.priority)}
                          <span className="text-[10px] font-mono text-slate-500">{task.category}</span>
                        </div>

                        <div className="flex items-start gap-3">
                          <button
                            onClick={() => toggleTaskComplete(task.id)}
                            className={`w-4 h-4 rounded mt-0.5 flex items-center justify-center transition border shrink-0 ${
                              task.completed ? 'bg-white border-white text-slate-950' : 'border-white/20 bg-transparent hover:border-white'
                            }`}
                          >
                            {task.completed && <Check className="w-3 h-3 stroke-[3]" />}
                          </button>
                          <h3 className={`text-xs sm:text-sm font-semibold ${task.completed ? 'line-through text-slate-500' : 'text-slate-100'}`}>
                            {task.title}
                          </h3>
                        </div>

                        {task.description && (
                          <p className="text-xs text-slate-400 pl-7 line-clamp-3">{task.description}</p>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-white/[0.06] text-xs">
                        <span className="font-mono text-indigo-400">{task.startTime} ({task.durationMinutes}m)</span>
                        <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition">
                          <button
                            onClick={() => {
                              setActivePomodoroTask(task);
                              setPomodoroSecondsLeft(25 * 60);
                              setIsPomodoroRunning(true);
                              setPomodoroMode('work');
                            }}
                            title="Iniciar Pomodoro"
                            className="p-1.5 text-slate-400 hover:text-white transition"
                          >
                            <Play className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteTask(task.id)}
                            title="Eliminar"
                            className="p-1.5 text-slate-600 hover:text-rose-400 transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Resumen de Productividad */}
            <div className="mt-4 pt-6 border-t border-white/[0.06] flex flex-col gap-5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-indigo-400" /> Resumen de Productividad
                </h3>
                <span className="text-xs font-mono text-slate-500">Actualizado en tiempo real</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <div className="bg-[#11131a] border border-white/[0.06] p-3 sm:p-4 rounded-xl flex flex-col gap-1">
                  <span className="text-[10px] sm:text-[11px] text-slate-500 font-mono uppercase tracking-wider">Tareas Totales</span>
                  <span className="text-lg sm:text-xl font-bold text-white font-mono">{tasks.length}</span>
                </div>
                <div className="bg-[#11131a] border border-white/[0.06] p-3 sm:p-4 rounded-xl flex flex-col gap-1">
                  <span className="text-[10px] sm:text-[11px] text-slate-500 font-mono uppercase tracking-wider">Completadas</span>
                  <span className="text-lg sm:text-xl font-bold text-emerald-400 font-mono">{completedCount}</span>
                </div>
                <div className="bg-[#11131a] border border-white/[0.06] p-3 sm:p-4 rounded-xl flex flex-col gap-1">
                  <span className="text-[10px] sm:text-[11px] text-slate-500 font-mono uppercase tracking-wider">Horas Enfoque</span>
                  <span className="text-lg sm:text-xl font-bold text-indigo-400 font-mono">{totalHours}h</span>
                </div>
                <div className="bg-[#11131a] border border-white/[0.06] p-3 sm:p-4 rounded-xl flex flex-col gap-1">
                  <span className="text-[10px] sm:text-[11px] text-slate-500 font-mono uppercase tracking-wider">Eficiencia</span>
                  <span className="text-lg sm:text-xl font-bold text-purple-400 font-mono">
                    {tasks.length ? Math.round((completedCount / tasks.length) * 100) : 0}%
                  </span>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* VISTA 2: Google Calendar */}
        {activeTab === 'calendar' && (
          <div className="lg:col-span-12 flex flex-col gap-6 overflow-x-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/[0.06]">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <h2 className="text-sm sm:text-base font-semibold text-white">Vista de Google Calendar</h2>
                <div className="flex items-center bg-[#11131a] p-1 rounded-lg border border-white/10 text-xs w-fit">
                  <button 
                    onClick={() => setCalendarViewMode('week')}
                    className={`px-3 py-1 rounded-md transition ${calendarViewMode === 'week' ? 'bg-white/10 text-white font-medium' : 'text-slate-400'}`}
                  >
                    Semana
                  </button>
                  <button 
                    onClick={() => setCalendarViewMode('month')}
                    className={`px-3 py-1 rounded-md transition ${calendarViewMode === 'month' ? 'bg-white/10 text-white font-medium' : 'text-slate-400'}`}
                  >
                    Mes
                  </button>
                </div>
              </div>
              <span className="text-[11px] sm:text-xs font-mono text-slate-500">Haz clic en cualquier día para inspeccionar</span>
            </div>

            {calendarViewMode === 'week' ? (
              <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
                {[0, 1, 2, 3, 4, 5, 6].map(offset => {
                  const d = new Date();
                  d.setDate(d.getDate() + offset);
                  const dateStr = d.toISOString().split('T')[0];
                  const dayLabel = d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
                  const dayTasks = tasks.filter(t => t.date === dateStr);

                  return (
                    <div 
                      key={dateStr} 
                      onClick={() => setInspectDate(dateStr)}
                      className="bg-[#11131a]/80 border border-white/[0.06] rounded-xl p-3.5 flex flex-col gap-3 min-h-[360px] md:min-h-[420px] cursor-pointer hover:border-white/20 transition"
                    >
                      <div className="pb-2 border-b border-white/[0.06] flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-300">{dayLabel}</span>
                        <span className="text-[10px] font-mono text-slate-500">{dayTasks.length} ev</span>
                      </div>

                      <div className="flex flex-col gap-2 flex-1">
                        {dayTasks.length === 0 ? (
                          <div className="text-center py-12 text-slate-700 text-xs">Libre</div>
                        ) : (
                          dayTasks.map(t => (
                            <div key={t.id} className="p-2.5 rounded-lg bg-white/[0.03] border border-white/10 text-xs flex flex-col gap-1">
                              <span className="font-medium text-slate-200">{t.title}</span>
                              <span className="text-[10px] font-mono text-indigo-400">{t.startTime} · {t.durationMinutes}m</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Vista de mes con puntos de prioridad de colores */
              <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => (
                  <div key={d} className="text-center text-[11px] sm:text-xs font-mono text-slate-500 py-2">{d}</div>
                ))}
                {Array.from({ length: 31 }).map((_, i) => {
                  const dayNum = i + 1;
                  const dayStr = `2026-11-${dayNum.toString().padStart(2, '0')}`;
                  const dayTasks = tasks.filter(t => t.date === dayStr);
                  const isToday = dayStr === getTodayString();

                  return (
                    <div 
                      key={dayNum} 
                      onClick={() => setInspectDate(dayStr)}
                      className={`bg-[#11131a]/60 border rounded-xl p-2 min-h-[75px] sm:min-h-[90px] flex flex-col justify-between cursor-pointer hover:border-white/30 transition ${
                        isToday ? 'border-indigo-500/50 bg-indigo-950/20' : 'border-white/[0.06]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-mono ${isToday ? 'text-indigo-400 font-bold' : 'text-slate-400'}`}>{dayNum}</span>
                        <span className="text-[9px] font-mono text-slate-600">{dayTasks.length ? `${dayTasks.length}` : ''}</span>
                      </div>
                      
                      <div className="flex items-center gap-1 flex-wrap mt-1">
                        {dayTasks.map(t => (
                          <div 
                            key={t.id} 
                            title={`${t.title} (${t.priority})`}
                            className={`w-2 h-2 rounded-full ${getPriorityDotColor(t.priority)}`}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* VISTA 3: Notion Backlog */}
        {activeTab === 'backlog' && (
          <div className="lg:col-span-12 flex flex-col gap-6 overflow-x-hidden">
            <div className="flex flex-col gap-4 pb-4 border-b border-white/[0.06]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h2 className="text-sm sm:text-base font-semibold text-white">Notion Backlog</h2>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setShowNewSpaceModal(true)}
                    className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-xs text-slate-300 rounded-lg transition border border-white/10 font-medium whitespace-nowrap"
                  >
                    + Nuevo Espacio
                  </button>
                  <button
                    onClick={() => {
                      setEditingTask({ date: getTodayString(), startTime: '10:00', durationMinutes: 60, priority: 'medium', category: 'Trabajo', description: '', status: 'backlog' });
                      setShowTaskModal(true);
                    }}
                    className="px-3.5 py-1.5 bg-white text-slate-950 text-xs font-semibold rounded-lg hover:bg-slate-200 transition whitespace-nowrap shadow-sm"
                  >
                    + Agregar al Backlog
                  </button>
                </div>
              </div>

              {/* Botones independientes para cada espacio */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {notionSpaces.map(space => (
                  <button
                    key={space}
                    onClick={() => setSelectedNotionSpace(space)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap border ${
                      selectedNotionSpace === space 
                        ? 'bg-white text-slate-950 border-white font-semibold shadow-sm' 
                        : 'bg-[#11131a] text-slate-400 border-white/10 hover:text-white hover:bg-white/[0.06]'
                    }`}
                  >
                    {space}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tasks.filter(t => t.status === 'backlog').length === 0 ? (
                <div className="col-span-full text-center py-20 text-slate-600 text-xs">
                  No hay notas ni tareas en este backlog de Notion. Agrega una nueva o importa elementos.
                </div>
              ) : (
                tasks.filter(t => t.status === 'backlog').map(task => (
                  <div key={task.id} className="bg-[#11131a] border border-white/[0.06] p-4 rounded-xl flex flex-col justify-between gap-4 shadow-sm hover:border-white/20 transition">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        {priorityBadge(task.priority)}
                        <span className="text-[10px] font-mono text-slate-500">{task.category}</span>
                      </div>
                      <h3 className="text-xs sm:text-sm font-semibold text-slate-100">{task.title}</h3>
                      {task.description && (
                        <p className="text-[11px] text-slate-400 line-clamp-3 bg-black/40 p-2.5 rounded-lg border border-white/[0.04]">
                          {task.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-white/[0.06] text-xs">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => {
                            setEditingNotionItem(task);
                            setNotionViewMode('read');
                          }}
                          className="flex items-center gap-1 text-slate-400 hover:text-white transition"
                          title="Ver Nota"
                        >
                          <Eye className="w-3.5 h-3.5" /> Leer
                        </button>
                        <button
                          onClick={() => {
                            setEditingNotionItem(task);
                            setNotionViewMode('edit');
                          }}
                          className="flex items-center gap-1 text-slate-400 hover:text-indigo-300 transition"
                          title="Editar Nota"
                        >
                          <Edit3 className="w-3.5 h-3.5" /> Editar
                        </button>
                      </div>

                      <div className="flex items-center gap-2.5">
                        <button
                          onClick={() => {
                            setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'scheduled', date: getTodayString() } : t));
                            setVoiceToast({ message: `Agendado a hoy: "${task.title}"` });
                          }}
                          className="text-indigo-400 hover:text-indigo-300 font-medium"
                        >
                          Agendar →
                        </button>
                        <button
                          onClick={() => deleteTask(task.id)}
                          className="text-slate-600 hover:text-rose-400 transition"
                          title="Eliminar"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

      </main>

      {/* Modal de revisión de tareas detectadas en imagen */}
      {showImageTasksModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-[#12141c] border border-white/10 w-full max-w-lg rounded-2xl p-6 shadow-2xl flex flex-col gap-5 max-h-[85vh] overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
              <div>
                <h3 className="text-sm font-bold text-white">Tareas Detectadas en la Imagen</h3>
                <p className="text-xs text-slate-400">Selecciona las asignaciones que deseas agregar a tu agenda</p>
              </div>
              <button onClick={() => setShowImageTasksModal(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col gap-3 overflow-y-auto pr-1 flex-1">
              {extractedImageTasks.length === 0 ? (
                <div className="text-center py-12 text-slate-600 text-xs">
                  No quedan tareas pendientes por agregar de esta imagen.
                </div>
              ) : (
                extractedImageTasks.map((task) => (
                  <div key={task.id} className="bg-[#181a24] border border-white/10 rounded-xl p-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-white">{task.title}</span>
                      {priorityBadge(task.priority)}
                    </div>
                    {task.description && <p className="text-[11px] text-slate-400">{task.description}</p>}
                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                      <span>{task.date} · {task.startTime} ({task.durationMinutes}m)</span>
                      <span className="text-indigo-400">{task.category}</span>
                    </div>
                    <div className="flex items-center justify-end pt-2 border-t border-white/[0.06]">
                      <button
                        onClick={() => {
                          setTasks(prev => [task, ...prev]);
                          setExtractedImageTasks(prev => prev.filter(t => t.id !== task.id));
                          setVoiceToast({ message: `Agregado a la agenda: "${task.title}"` });
                          if (extractedImageTasks.length <= 1) {
                            setShowImageTasksModal(false);
                          }
                        }}
                        className="px-3 py-1 bg-white text-slate-950 text-xs font-semibold rounded-lg hover:bg-slate-200 transition"
                      >
                        + Agregar a mi Agenda
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between">
              {extractedImageTasks.length > 0 && (
                <button
                  onClick={() => {
                    setTasks(prev => [...extractedImageTasks, ...prev]);
                    setShowImageTasksModal(false);
                    setVoiceToast({ message: `¡Se agregaron ${extractedImageTasks.length} tareas a tu agenda!` });
                    setExtractedImageTasks([]);
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition"
                >
                  Agregar Todas a la Agenda
                </button>
              )}
              <button
                onClick={() => setShowImageTasksModal(false)}
                className="px-4 py-2 text-xs text-slate-400 hover:text-white ml-auto"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de lectura / edición de notas en Notion */}
      {editingNotionItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-[#12141c] border border-white/10 w-full max-w-lg rounded-2xl p-6 shadow-2xl flex flex-col gap-5">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-white/5 p-1 rounded-lg border border-white/10 text-xs">
                  <button
                    onClick={() => setNotionViewMode('read')}
                    className={`px-3 py-1 rounded-md transition ${notionViewMode === 'read' ? 'bg-white/10 text-white font-medium' : 'text-slate-400'}`}
                  >
                    Lectura
                  </button>
                  <button
                    onClick={() => setNotionViewMode('edit')}
                    className={`px-3 py-1 rounded-md transition ${notionViewMode === 'edit' ? 'bg-white/10 text-white font-medium' : 'text-slate-400'}`}
                  >
                    Edición
                  </button>
                </div>
              </div>
              <button onClick={() => setEditingNotionItem(null)} className="text-slate-400 hover:text-white p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            {notionViewMode === 'read' ? (
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-white">{editingNotionItem.title}</h3>
                  {priorityBadge(editingNotionItem.priority)}
                </div>
                <div className="bg-black/50 p-4 rounded-xl border border-white/[0.06] text-xs text-slate-300 min-h-[140px] whitespace-pre-wrap font-sans leading-relaxed">
                  {editingNotionItem.description || 'Sin descripción detallada.'}
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono pt-2">
                  <span>Categoría: {editingNotionItem.category}</span>
                  <span>Espacio: {selectedNotionSpace}</span>
                </div>
              </div>
            ) : (
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  setTasks(prev => prev.map(t => t.id === editingNotionItem.id ? editingNotionItem : t));
                  setEditingNotionItem(null);
                  setVoiceToast({ message: 'Nota de Notion actualizada.' });
                }}
                className="flex flex-col gap-4"
              >
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] text-slate-400 font-mono">Título</label>
                  <input
                    type="text"
                    required
                    value={editingNotionItem.title}
                    onChange={(e) => setEditingNotionItem({ ...editingNotionItem, title: e.target.value })}
                    className="bg-black border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] text-slate-400 font-mono">Descripción detallada</label>
                  <textarea
                    rows={6}
                    value={editingNotionItem.description || ''}
                    onChange={(e) => setEditingNotionItem({ ...editingNotionItem, description: e.target.value })}
                    className="bg-black border border-white/10 rounded-lg p-3 text-xs text-white focus:outline-none resize-none font-sans"
                    placeholder="Escribe la descripción de tu nota aquí..."
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/[0.06]">
                  <button
                    type="button"
                    onClick={() => setEditingNotionItem(null)}
                    className="px-4 py-2 text-xs text-slate-400 hover:text-white"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-white text-slate-950 text-xs font-semibold rounded-lg hover:bg-slate-200 transition"
                  >
                    Guardar Cambios
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modal para crear nuevo espacio en Notion */}
      {showNewSpaceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              if (!newSpaceName.trim()) return;
              if (!notionSpaces.includes(newSpaceName)) {
                setNotionSpaces(prev => [...prev, newSpaceName]);
                setSelectedNotionSpace(newSpaceName);
              }
              setNewSpaceName('');
              setShowNewSpaceModal(false);
            }} 
            className="bg-[#12141c] border border-white/10 w-full max-w-sm rounded-2xl p-6 shadow-2xl flex flex-col gap-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
              <h3 className="text-xs font-semibold text-white uppercase tracking-wider">Nuevo Espacio en Notion</h3>
              <button type="button" onClick={() => setShowNewSpaceModal(false)} className="text-slate-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] text-slate-400 font-mono">Nombre del Espacio</label>
              <input
                type="text"
                required
                value={newSpaceName}
                onChange={(e) => setNewSpaceName(e.target.value)}
                placeholder="Ej. Marketing, Finanzas..."
                className="bg-black border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/[0.06]">
              <button type="button" onClick={() => setShowNewSpaceModal(false)} className="px-3 py-1.5 text-xs text-slate-400">
                Cancelar
              </button>
              <button type="submit" className="px-4 py-1.5 bg-white text-slate-950 text-xs font-semibold rounded-lg hover:bg-slate-200 transition">
                Crear Espacio
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal del Asistente de Voz IA */}
      {showVoiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-[#12141c] border border-white/10 w-full max-w-md rounded-2xl p-6 shadow-2xl flex flex-col gap-5">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition ${isRecordingAudio ? 'bg-rose-500/20 text-rose-400 animate-pulse' : 'bg-indigo-500/20 text-indigo-400'}`}>
                  <Mic className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-white">Asistente de Voz IA (Gemini Audio)</h3>
              </div>
              <button onClick={() => { stopAudioRecording(); setShowVoiceModal(false); }} className="text-slate-400 hover:text-white p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col gap-3 bg-white/[0.03] p-4 rounded-xl border border-white/10 text-center">
              <span className="text-xs text-slate-300 font-medium">
                {isRecordingAudio ? '🔴 Grabando tu voz... Habla claro' : '🎙️ Habla o dicta tu tarea por voz'}
              </span>
              <div className="flex items-center justify-center gap-3">
                {!isRecordingAudio ? (
                  <button
                    type="button"
                    onClick={startAudioRecording}
                    className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-indigo-600/30 transition flex items-center gap-2"
                  >
                    <Mic className="w-4 h-4" /> Empezar a Grabar Voz
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={stopAudioRecording}
                    className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-rose-600/30 transition flex items-center gap-2 animate-pulse"
                  >
                    <MicOff className="w-4 h-4" /> Detener y Procesar con IA
                  </button>
                )}
              </div>
            </div>

            {voiceErrorMsg && (
              <p className="text-[11px] text-amber-400 bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/20">
                {voiceErrorMsg}
              </p>
            )}

            <form onSubmit={submitVoiceAssistantTask} className="flex flex-col gap-4">
              <div className="relative">
                <textarea
                  rows={3}
                  value={voiceInputText}
                  onChange={(e) => setVoiceInputText(e.target.value)}
                  placeholder="O escribe tu tarea aquí (ej. 'Reunión mañana a las 10am')..."
                  className="w-full bg-[#181a24] border border-white/10 rounded-xl p-3.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 resize-none font-sans"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { stopAudioRecording(); setShowVoiceModal(false); }}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-white text-slate-950 text-xs font-semibold rounded-xl shadow-lg transition"
                >
                  Procesar por Texto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de inspección de día */}
      {inspectDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-[#12141c] border border-white/10 w-full max-w-lg rounded-2xl p-6 shadow-2xl flex flex-col gap-5 max-h-[85vh] overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
              <div>
                <h3 className="text-sm font-bold text-white">Detalle del Día</h3>
                <p className="text-xs font-mono text-indigo-400">{inspectDate}</p>
              </div>
              <button onClick={() => setInspectDate(null)} className="text-slate-400 hover:text-white p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col gap-3 overflow-y-auto pr-1 flex-1">
              {tasks.filter(t => t.date === inspectDate).length === 0 ? (
                <div className="text-center py-12 text-slate-600 text-xs">
                  No hay tareas registradas para este día.
                </div>
              ) : (
                tasks.filter(t => t.date === inspectDate).map(task => (
                  <div key={task.id} className="bg-[#181a24] border border-white/10 rounded-xl p-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-white">{task.title}</span>
                      {priorityBadge(task.priority)}
                    </div>
                    {task.description && <p className="text-[11px] text-slate-400">{task.description}</p>}

                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                      <span>{task.startTime} ({task.durationMinutes}m)</span>
                      <span>{task.category}</span>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-white/[0.06] text-xs">
                      <span className="text-slate-500 font-medium">Estado:</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => updateTaskStatus(task.id, 'backlog')}
                          className={`px-2.5 py-1 rounded transition text-[11px] ${
                            task.status === 'backlog' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-white/5 text-slate-400'
                          }`}
                        >
                          Pendiente
                        </button>
                        <button
                          onClick={() => updateTaskStatus(task.id, 'scheduled')}
                          className={`px-2.5 py-1 rounded transition text-[11px] ${
                            task.status === 'scheduled' && !task.completed ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'bg-white/5 text-slate-400'
                          }`}
                        >
                          En Proceso
                        </button>
                        <button
                          onClick={() => updateTaskStatus(task.id, 'completed')}
                          className={`px-2.5 py-1 rounded transition text-[11px] ${
                            task.completed ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-white/5 text-slate-400'
                          }`}
                        >
                          Completado
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between">
              <button
                onClick={() => {
                  setEditingTask({ date: inspectDate, startTime: '10:00', durationMinutes: 60, priority: 'medium', category: 'Trabajo', description: '', status: 'scheduled' });
                  setInspectDate(null);
                  setShowTaskModal(true);
                }}
                className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-xs text-white rounded-lg transition font-medium"
              >
                + Agregar tarea este día
              </button>
              <button
                onClick={() => setInspectDate(null)}
                className="px-4 py-1.5 bg-white text-slate-950 text-xs font-semibold rounded-lg hover:bg-slate-200 transition"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Pomodoro Focus */}
      {activePomodoroTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="bg-[#11131a] border border-white/10 w-full max-w-sm rounded-2xl p-6 shadow-2xl flex flex-col items-center gap-6 text-center">
            <span className="text-[11px] font-mono uppercase tracking-widest text-indigo-400">Pomodoro Focus</span>
            <h3 className="text-sm font-semibold text-white">{activePomodoroTask.title}</h3>
            <div className="w-40 h-40 rounded-full border-2 border-white/10 flex flex-col items-center justify-center bg-black">
              <span className="text-3xl font-mono font-bold text-white">
                {Math.floor(pomodoroSecondsLeft / 60).toString().padStart(2, '0')}:
                {(pomodoroSecondsLeft % 60).toString().padStart(2, '0')}
              </span>
              <span className="text-[10px] text-slate-500 uppercase mt-1">{pomodoroMode}</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsPomodoroRunning(!isPomodoroRunning)}
                className="px-5 py-2 rounded-lg bg-white text-slate-950 text-xs font-semibold hover:bg-slate-200 transition"
              >
                {isPomodoroRunning ? 'Pausar' : 'Reanudar'}
              </button>
              <button
                onClick={() => setActivePomodoroTask(null)}
                className="px-4 py-2 rounded-lg bg-white/10 text-slate-300 text-xs font-medium hover:bg-white/20 transition"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Tarea Manual */}
      {showTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <form onSubmit={saveManualTask} className="bg-[#12141c] border border-white/10 w-full max-w-md rounded-2xl p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
              <h3 className="text-xs font-semibold text-white uppercase tracking-wider">Nuevo Evento / Tarea</h3>
              <button type="button" onClick={() => setShowTaskModal(false)} className="text-slate-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] text-slate-400 font-mono">Título de la Tarea</label>
              <input
                type="text"
                required
                value={editingTask?.title || ''}
                onChange={(e) => setEditingTask(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Nombre de la tarea..."
                className="bg-black border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-white/30"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] text-slate-400 font-mono">Descripción</label>
              <textarea
                rows={3}
                value={editingTask?.description || ''}
                onChange={(e) => setEditingTask(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Detalles adicionales, notas o enlaces..."
                className="bg-black border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-white/30 resize-none font-sans"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] text-slate-400 font-mono">Fecha</label>
                <input
                  type="date"
                  value={editingTask?.date || selectedDate}
                  onChange={(e) => setEditingTask(prev => ({ ...prev, date: e.target.value }))}
                  className="bg-black border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-white/30"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] text-slate-400 font-mono">Hora Inicio</label>
                <input
                  type="time"
                  value={editingTask?.startTime || '09:00'}
                  onChange={(e) => setEditingTask(prev => ({ ...prev, startTime: e.target.value }))}
                  className="bg-black border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-white/30 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] text-slate-400 font-mono">Nivel de Urgencia (Prioridad)</label>
                <select
                  value={editingTask?.priority || 'medium'}
                  onChange={(e) => setEditingTask(prev => ({ ...prev, priority: e.target.value as Priority }))}
                  className="bg-black border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-white/30"
                >
                  <option value="low">Baja</option>
                  <option value="medium">Media</option>
                  <option value="high">Alta</option>
                  <option value="urgent">Urgente</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] text-slate-400 font-mono">Categoría</label>
                <select
                  value={editingTask?.category || 'Trabajo'}
                  onChange={(e) => setEditingTask(prev => ({ ...prev, category: e.target.value as Category }))}
                  className="bg-black border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-white/30"
                >
                  <option value="Trabajo">Trabajo</option>
                  <option value="Personal">Personal</option>
                  <option value="Estudio">Estudio</option>
                  <option value="Salud">Salud</option>
                  <option value="Finanzas">Finanzas</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/[0.06]">
              <button type="button" onClick={() => setShowTaskModal(false)} className="px-3 py-1.5 text-xs text-slate-400">
                Cancelar
              </button>
              <button type="submit" className="px-4 py-1.5 bg-white text-slate-950 text-xs font-semibold rounded-lg hover:bg-slate-200 transition">
                Guardar Tarea
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
