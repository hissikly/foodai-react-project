import React, { useState, useEffect } from 'react';
import Layout from './Layout';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/firebase';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, Timestamp } from 'firebase/firestore';
import DOMPurify from 'dompurify';
import { Alert, CircularProgress } from '@mui/material';
// Removed: import { isEntryInCurrentMoscowDay } from '../utils/timeUtils';

// Функция для валидации и санитизации данных
const sanitizeEntryData = (data) => {
  const sanitized = { ...data };
  
  // Санитизация текстовых полей
  if (sanitized.notes) {
    sanitized.notes = DOMPurify.sanitize(sanitized.notes);
  }
  if (sanitized.foodName) {
    sanitized.foodName = DOMPurify.sanitize(sanitized.foodName);
  }
  
  // Валидация числовых полей
  if (sanitized.calories) {
    sanitized.calories = Math.max(0, Math.min(10000, Number(sanitized.calories)));
  }
  if (sanitized.proteins) {
    sanitized.proteins = Math.max(0, Math.min(1000, Number(sanitized.proteins)));
  }
  if (sanitized.fats) {
    sanitized.fats = Math.max(0, Math.min(1000, Number(sanitized.fats)));
  }
  if (sanitized.carbs) {
    sanitized.carbs = Math.max(0, Math.min(1000, Number(sanitized.carbs)));
  }
  
  return sanitized;
};

export default function Journal() {
  const { currentUser } = useAuth();
  const [foodEntries, setFoodEntries] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);
  const [editableNotes, setEditableNotes] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!currentUser) {
      setFoodEntries([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const now = new Date();
      const moscowOffset = 3 * 60 * 60 * 1000;
      const localOffset = now.getTimezoneOffset() * 60 * 1000;
      const utc = now.getTime() + localOffset;
      const moscowTime = new Date(utc + moscowOffset);

      const startOfDayMoscow = new Date(moscowTime);
      startOfDayMoscow.setHours(0, 0, 0, 0);

      const endOfDayMoscow = new Date(moscowTime);
      endOfDayMoscow.setHours(23, 59, 59, 999);

      const startTimestamp = Timestamp.fromDate(new Date(startOfDayMoscow.getTime() - moscowOffset + localOffset));
      const endTimestamp = Timestamp.fromDate(new Date(endOfDayMoscow.getTime() - moscowOffset + localOffset));

      const entriesCollectionRef = collection(db, 'foodEntries');
      const q = query(
        entriesCollectionRef,
        where('userId', '==', currentUser.uid),
        where('timestamp', '>=', startTimestamp),
        where('timestamp', '<=', endTimestamp),
        orderBy('timestamp', 'desc')
      );

      const unsubscribe = onSnapshot(q, 
        (snapshot) => {
          const entries = snapshot.docs.map(doc => ({
            id: doc.id,
            ...sanitizeEntryData(doc.data())
          }));
          setFoodEntries(entries);
          setLoading(false);
        },
        (error) => {
          console.error('Ошибка при получении записей:', error);
          setError('Не удалось загрузить записи');
          setLoading(false);
        }
      );

      return () => unsubscribe();
    } catch (err) {
      console.error('Ошибка при настройке подписки:', err);
      setError('Произошла ошибка при загрузке данных');
      setLoading(false);
    }
  }, [currentUser]);

  const handleNoteInputChange = (id, value) => {
    setEditableNotes(prev => ({ ...prev, [id]: value }));
  };

  const handleSaveNote = async (entryId) => {
    if (!currentUser) return;
    const noteToSave = editableNotes[entryId];
    if (typeof noteToSave === 'string') {
      try {
        const entryRef = doc(db, 'foodEntries', entryId);
        await updateDoc(entryRef, {
          note: noteToSave
        });
      } catch (error) {
        console.error('Ошибка при сохранении заметки:', error);
      }
    }
  };

  if (loading) {
    return <Layout><div className="text-center p-10">Загрузка дневника...</div></Layout>;
  }

  return (
    <Layout>
      {error && (
        <Alert severity="error" onClose={() => setError(null)} className="mb-4">
          {error}
        </Alert>
      )}
      
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <CircularProgress />
        </div>
      ) : (
        <div className="space-y-4 max-w-5xl mx-auto bg-white p-4 rounded-xl shadow-sm">
          <h2 className="text-xl font-bold mb-4 text-center">Дневник питания</h2>
          
          {foodEntries.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm p-6 text-center">
              <p className="text-gray-500">Записей за сегодня нет. Новые записи добавляются через раздел "Распознать еду".</p>
            </div>
          ) : (
            foodEntries.map(entry => (
              <div key={entry.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
                {entry.image && (
                  <img 
                    src={entry.image} 
                    alt={entry.description || "Загруженное блюдо"}
                    className="w-full h-64 object-cover cursor-pointer hover:opacity-90 transition-opacity" 
                    onClick={() => setSelectedImage(entry.image)}
                  />
                )}
                <div className="p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium">{entry.description || 'Нет описания'}</h3>
                      <p className="text-sm text-gray-500">
                        {entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : 'Нет времени'}
                      </p>
                    </div>
                    <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-medium">
                      {entry.calories || 0} ккал
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-4 gap-2 text-xs">
                    <div className="text-center py-1 border-r border-gray-200">
                      <div className="font-semibold">{entry.protein || 0}г</div>
                      <div className="text-gray-500">Белки</div>
                    </div>
                    <div className="text-center py-1 border-r border-gray-200">
                      <div className="font-semibold">{entry.carbs || 0}г</div>
                      <div className="text-gray-500">Углеводы</div>
                    </div>
                    <div className="text-center py-1 border-r border-gray-200">
                      <div className="font-semibold">{entry.fat || 0}г</div>
                      <div className="text-gray-500">Жиры</div>
                    </div>
                    <div className="text-center py-1">
                      <div className="font-semibold">{entry.portionSize || '-'}</div>
                      <div className="text-gray-500">Порция</div>
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="flex items-center space-x-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                      <textarea
                        className="w-full p-2 border border-gray-300 rounded-lg resize-none h-12 flex-grow"
                        placeholder="Добавьте заметку..."
                        value={editableNotes[entry.id] || ''}
                        onChange={(e) => handleNoteInputChange(entry.id, e.target.value)}
                      />
                      <button 
                        onClick={() => handleSaveNote(entry.id)}
                        className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm h-12"
                      >
                        Сохр.
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {selectedImage && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-4xl w-full">
            <img 
              src={selectedImage} 
              alt="Увеличенное изображение" 
              className="w-full h-auto max-h-[90vh] object-contain rounded-lg"
            />
            <button 
              className="absolute top-4 right-4 text-white bg-black bg-opacity-50 rounded-full p-2 hover:bg-opacity-75"
              onClick={() => setSelectedImage(null)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </Layout>
  );
}

