import  { createContext, useContext, useState, useCallback } from 'react';
import { NotifyContainer } from '@/components/ui/notify';

const NotifyContext = createContext();

export const NotifyProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);

  const addNotification = useCallback((message, type = 'info', duration = 4000, position = 'bottom-right') => {
    const id = Math.random().toString(36).substr(2, 9);
    setNotifications((prev) => [...prev, { id, message, type, duration, position }]);

    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, duration);
  }, []);

  const removeNotification = useCallback((id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  // On groupe les notifications par position
  const positions = ['top-right', 'top-left', 'bottom-right', 'bottom-left'];

  return (
    <NotifyContext.Provider value={addNotification}>
      {children}
      {positions.map((pos) => (
        <NotifyContainer
          key={pos}
          position={pos}
          notifications={notifications.filter(n => n.position === pos)}
          remove={removeNotification}
        />
      ))}
    </NotifyContext.Provider>
  );
};

export const useNotify = () => useContext(NotifyContext);