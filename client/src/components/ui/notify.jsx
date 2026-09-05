import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertCircle, Info, X, AlertTriangle } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

const NotifyContainer = ({ position, notifications, remove }) => {
  const isMobile = useIsMobile();

  const mobilePosition = 'top-right';
  const effectivePosition = isMobile ? mobilePosition : position;

  const positionClasses = {
    'top-right': isMobile
      ? 'top-[5.5rem] right-3 items-stretch'
      : 'top-5 right-5 items-end',
    'top-left': isMobile
      ? 'top-[5.5rem] right-3 items-stretch'
      : 'top-5 left-5 items-start',
    'bottom-right': 'bottom-5 right-5 items-end',
    'bottom-left': 'bottom-5 left-5 items-start',
  };

  return (
    <div className={`fixed z-99999 flex flex-col gap-3 pointer-events-none ${positionClasses[effectivePosition]}`}>
      <AnimatePresence>
        {notifications.map((n) => (
          <NotificationItem key={n.id} notification={n} remove={remove} isMobile={isMobile} />
        ))}
      </AnimatePresence>
    </div>
  );
};

// Composant individuel avec animation et barre de progression
const NotificationItem = ({ notification, remove, isMobile }) => {
  const { id, message, type, duration } = notification;

  const config = {
    success: { bg: 'bg-emerald-500', icon: CheckCircle, shadow: 'shadow-emerald-200' },
    error: { bg: 'bg-red-500', icon: AlertCircle, shadow: 'shadow-red-200' },
    warning: { bg: 'bg-amber-500', icon: AlertTriangle, shadow: 'shadow-amber-200' },
    info: { bg: 'bg-blue-500', icon: Info, shadow: 'shadow-blue-200' },
  };

  const { bg, icon: Icon, shadow } = config[type] || config.info;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 50, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.2 } }}
      className={`pointer-events-auto relative flex items-center rounded-2xl shadow-2xl ${bg} text-white ${shadow} overflow-hidden ${
        isMobile ? 'w-fit p-1.5 px-4' : 'min-w-[320px] max-w-md p-4'
      }`}
    >
      <div className="flex items-center gap-3 flex-1">
        <Icon size={22} className="shrink-0" />
        <span className="text-xs lg:text-sm font-bold leading-tight">{message}</span>
      </div>

      <button
        onClick={() => remove(id)}
        className="p-1 hover:bg-white/20 rounded-lg transition-colors"
      >
        <X size={18} />
      </button>

      {/* Barre de progression visuelle */}
      <motion.div
        initial={{ width: '100%' }}
        animate={{ width: 0 }}
        transition={{ duration: duration / 1000, ease: "linear" }}
        className="absolute bottom-0 left-0 h-1 bg-black/20"
      />
    </motion.div>
  );
};

export { NotifyContainer };
