import React, { useState, useEffect } from 'react';
import Layout from './Layout';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/firebase';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, deleteDoc, Timestamp, getDoc } from 'firebase/firestore';
import DOMPurify from 'dompurify';
import { Alert, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, Button } from '@mui/material';

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

// Функция для форматирования даты
const formatDate = (date) => {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  // Проверяем, является ли дата сегодняшней
  if (date.toDateString() === today.toDateString()) {
    return 'Сегодня';
  }
  // Проверяем, является ли дата вчерашней
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Вчера';
  }

  // Форматируем дату для других дней
  const months = [
    'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
  ];

  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
};

// Функция для группировки записей по дням
const groupEntriesByDate = (entries) => {
  const groups = {};
  
  entries.forEach(entry => {
    const date = entry.timestamp instanceof Date ? entry.timestamp : new Date(entry.timestamp);
    const dateKey = date.toDateString();
    
    if (!groups[dateKey]) {
      groups[dateKey] = {
        date: date,
        entries: [],
        totalCalories: 0,
        totalProtein: 0,
        totalCarbs: 0,
        totalFat: 0
      };
    }
    groups[dateKey].entries.push(entry);
    groups[dateKey].totalCalories += entry.calories || 0;
    groups[dateKey].totalProtein += entry.protein || 0;
    groups[dateKey].totalCarbs += entry.carbs || 0;
    groups[dateKey].totalFat += entry.fat || 0;
  });

  // Сортируем группы по дате (от новых к старым)
  return Object.values(groups).sort((a, b) => b.date - a.date);
};

export default function Journal() {
  const { currentUser } = useAuth();
  const [foodEntries, setFoodEntries] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);
  const [editableNotes, setEditableNotes] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState(null);
  const [dailyGoal, setDailyGoal] = useState(2000); // Добавляем состояние для дневной нормы

  // Загрузка нормы калорий из профиля
  useEffect(() => {
    const loadProfileNorm = async () => {
      if (!currentUser) return;
      try {
        const profileRef = doc(db, 'profiles', currentUser.uid);
        const profileSnap = await getDoc(profileRef);
        if (profileSnap.exists()) {
          const data = profileSnap.data();
          if (data.calorieNorm) {
            setDailyGoal(data.calorieNorm);
          }
        }
      } catch (error) {
        console.error('Ошибка при загрузке нормы калорий из профиля:', error);
      }
    };
    loadProfileNorm();
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) {
      setFoodEntries([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const entriesCollectionRef = collection(db, 'foodEntries');
      const q = query(
        entriesCollectionRef,
        where('userId', '==', currentUser.uid),
        orderBy('timestamp', 'desc')
      );

      const unsubscribe = onSnapshot(q, 
        (snapshot) => {
          const entries = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              ...sanitizeEntryData(data),
              timestamp: data.timestamp?.toDate ? data.timestamp.toDate() : new Date(data.timestamp)
            };
          });
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
          notes: noteToSave
        });
        // Очищаем состояние редактирования после сохранения
        setEditableNotes(prev => {
          const newState = { ...prev };
          delete newState[entryId];
          return newState;
        });
      } catch (error) {
        console.error('Ошибка при сохранении заметки:', error);
      }
    }
  };

  // Добавляем эффект для загрузки заметок при получении записей
  useEffect(() => {
    if (foodEntries.length > 0) {
      const notes = {};
      foodEntries.forEach(entry => {
        if (entry.notes) {
          notes[entry.id] = entry.notes;
        }
      });
      setEditableNotes(notes);
    }
  }, [foodEntries]);

  const handleDeleteClick = (entry) => {
    setEntryToDelete(entry);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!entryToDelete || !currentUser) return;

    try {
      const entryRef = doc(db, 'foodEntries', entryToDelete.id);
      await deleteDoc(entryRef);
      setDeleteDialogOpen(false);
      setEntryToDelete(null);
    } catch (error) {
      console.error('Ошибка при удалении записи:', error);
      setError('Не удалось удалить запись');
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setEntryToDelete(null);
  };

  if (loading) {
    return <Layout><div className="text-center p-10">Загрузка дневника...</div></Layout>;
  }

  const groupedEntries = groupEntriesByDate(foodEntries);

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
        <div className="space-y-8 max-w-5xl mx-auto">
          <h2 className="text-xl font-bold mb-4 text-center">Дневник питания</h2>
          
          {groupedEntries.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm p-6 text-center">
              <p className="text-gray-500">Записей пока нет. Новые записи добавляются через раздел "Распознать еду".</p>
            </div>
          ) : (
            <div className="space-y-6">
              {groupedEntries.map(({ date, entries, totalCalories, totalProtein, totalCarbs, totalFat }) => {
                const progressPercentage = Math.min((totalCalories / dailyGoal) * 100, 100);
                const isOverLimit = totalCalories > dailyGoal;
                
                return (
                  <div key={date.toISOString()} className="bg-white rounded-xl shadow-sm overflow-hidden">
                    <div className="bg-gray-50 px-6 py-4 border-b border-gray-100">
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="text-lg font-semibold text-gray-700">
                          {formatDate(date)}
                        </h3>
                        <div className="flex items-center space-x-4">
                          <div className="text-right">
                            <div className="text-sm font-medium text-gray-600">
                              {totalCalories} / {dailyGoal} ккал
                            </div>
                            <div className="text-xs text-gray-500">
                              Б: {Math.round(totalProtein)}г · У: {Math.round(totalCarbs)}г · Ж: {Math.round(totalFat)}г
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-500 ease-out ${
                            isOverLimit ? 'bg-red-500' : 'bg-green-500'
                          }`}
                          style={{ width: `${progressPercentage}%` }}
                        ></div>
                      </div>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {entries.map(entry => (
                        <div key={entry.id} className="p-6">
                          {entry.image && (
                            <img 
                              src={entry.image} 
                              alt={entry.description || "Загруженное блюдо"}
                              className="w-full h-64 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity mb-4" 
                              onClick={() => setSelectedImage(entry.image)}
                            />
                          )}
                          <div className="flex justify-between items-start">
                            <div>
                              <h3 className="font-medium text-lg">{entry.description || 'Нет описания'}</h3>
                              <p className="text-sm text-gray-500 mt-1">
                                {entry.timestamp instanceof Date && !isNaN(entry.timestamp) 
                                  ? entry.timestamp.toLocaleTimeString('ru-RU', { 
                                      hour: '2-digit', 
                                      minute: '2-digit',
                                      hour12: false 
                                    })
                                  : 'Нет времени'}
                              </p>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-medium">
                                {entry.calories || 0} ккал
                              </span>
                              <button
                                onClick={() => handleDeleteClick(entry)}
                                className="p-1 text-red-500 hover:text-red-700 rounded-full hover:bg-red-50 transition-colors"
                                title="Удалить запись"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </div>
                          <div className="mt-4 grid grid-cols-4 gap-4 text-sm">
                            <div className="text-center p-2 bg-blue-50 rounded-lg">
                              <div className="font-semibold text-blue-700">{entry.protein || 0}г</div>
                              <div className="text-blue-600">Белки</div>
                            </div>
                            <div className="text-center p-2 bg-purple-50 rounded-lg">
                              <div className="font-semibold text-purple-700">{entry.carbs || 0}г</div>
                              <div className="text-purple-600">Углеводы</div>
                            </div>
                            <div className="text-center p-2 bg-yellow-50 rounded-lg">
                              <div className="font-semibold text-yellow-700">{entry.fat || 0}г</div>
                              <div className="text-yellow-600">Жиры</div>
                            </div>
                            <div className="text-center p-2 bg-gray-50 rounded-lg">
                              <div className="font-semibold text-gray-700">{entry.portionSize || '-'}</div>
                              <div className="text-gray-600">Порция</div>
                            </div>
                          </div>
                          {entry.ingredients && (
                            <div className="mt-4">
                              <div className="text-sm font-medium text-gray-700 mb-2">Ингредиенты:</div>
                              <div className="flex flex-wrap gap-2">
                                {(Array.isArray(entry.ingredients) ? entry.ingredients : [entry.ingredients]).map((ingredient, index) => (
                                  <span 
                                    key={index}
                                    className="px-3 py-1 bg-green-50 text-green-700 rounded-full text-sm"
                                  >
                                    {ingredient}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          <div className="mt-4">
                            <div className="flex items-center space-x-2">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                              {entry.notes && !editableNotes[entry.id] ? (
                                <div className="flex-grow">
                                  <div className="p-2 bg-gray-50 rounded-lg text-gray-700">
                                    {entry.notes}
                                  </div>
                                  <button 
                                    onClick={() => setEditableNotes(prev => ({ ...prev, [entry.id]: entry.notes }))}
                                    className="text-sm text-green-500 hover:text-green-600 mt-1"
                                  >
                                    Редактировать
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <textarea
                                    className="w-full p-2 border border-gray-200 rounded-lg resize-none h-12 flex-grow focus:border-green-500 focus:ring-1 focus:ring-green-500"
                                    placeholder="Добавьте заметку..."
                                    value={editableNotes[entry.id] || ''}
                                    onChange={(e) => handleNoteInputChange(entry.id, e.target.value)}
                                  />
                                  <button 
                                    onClick={() => handleSaveNote(entry.id)}
                                    className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm h-12 transition-colors"
                                  >
                                    {editableNotes[entry.id] === entry.notes ? 'Изменить' : 'Сохранить'}
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Диалог подтверждения удаления */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
        aria-labelledby="delete-dialog-title"
      >
        <DialogTitle id="delete-dialog-title">
          Подтверждение удаления
        </DialogTitle>
        <DialogContent>
          <p>Вы уверены, что хотите удалить эту запись? Это действие нельзя отменить.</p>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel} color="primary">
            Отмена
          </Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            Удалить
          </Button>
        </DialogActions>
      </Dialog>

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

