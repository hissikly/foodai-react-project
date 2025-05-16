import React, { useState, useRef, useEffect } from 'react';
import Layout from './Layout';
import parseAIMessage from '../utils/parseAIMessage';
import { analyzeFoodImage } from '../utils/aiModel';
import { getMoscowTime } from '../utils/timeUtils';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/firebase';
import { collection, addDoc, Timestamp, query, where, orderBy, onSnapshot, serverTimestamp, doc, getDoc, setDoc } from 'firebase/firestore';
import { Alert, CircularProgress } from '@mui/material';
import imageCompression from 'browser-image-compression';

// Функция для оптимизации изображения
const optimizeImage = async (file) => {
  const options = {
    maxSizeMB: 1,
    maxWidthOrHeight: 1920,
    useWebWorker: true,
    fileType: 'image/jpeg'
  };

  try {
    const compressedFile = await imageCompression(file, options);
    return compressedFile;
  } catch (error) {
    console.error('Ошибка при оптимизации изображения:', error);
    throw new Error('Не удалось оптимизировать изображение');
  }
};

export default function Foodai() {
  const { currentUser } = useAuth();
  const [foodEntries, setFoodEntries] = useState([]);
  const [imagePreview, setImagePreview] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [dailyGoal, setDailyGoal] = useState(2000); // Начальное значение
  const fileInputRef = useRef(null);

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

  // Подписка на записи из Firestore
  useEffect(() => {
    if (!currentUser) {
      setFoodEntries([]);
      return;
    }

    const now = new Date();
    const moscowOffset = 3 * 60 * 60 * 1000; // Moscow is UTC+3
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

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const entries = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        entries.push({
          id: doc.id,
          ...data,
          timestamp: data.timestamp?.toDate ? data.timestamp.toDate() : new Date(data.timestamp)
        });
      });
      setFoodEntries(entries);
    }, (error) => {
      console.error('Ошибка при загрузке записей из Firestore:', error);
    });

    return () => unsubscribe();
  }, [currentUser]);

  const totalStats = foodEntries.reduce(
    (acc, entry) => {
      acc.calories += entry.calories || 0;
      acc.protein += entry.protein || 0;
      acc.carbs += entry.carbs || 0;
      acc.fat += entry.fat || 0;
      return acc;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const progressPercentage = Math.min((totalStats.calories / dailyGoal) * 100, 100);

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Проверка типа файла
    if (!file.type.startsWith('image/')) {
      setError('Пожалуйста, загрузите изображение');
      return;
    }

    // Проверка размера файла (до оптимизации)
    if (file.size > 10 * 1024 * 1024) { // 10MB
      setError('Размер изображения не должен превышать 10MB');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      // Оптимизация изображения
      const optimizedFile = await optimizeImage(file);

      // Создание превью
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(optimizedFile);

      // Анализ изображения
      const aiResponse = await analyzeFoodImage(optimizedFile);
      const parsed = parseAIMessage(aiResponse);
      setAnalysisResult(parsed);
    } catch (err) {
      console.error("Ошибка при обработке изображения:", err);
      setError(err.message || "Не удалось обработать изображение");
      setImagePreview(null);
      setAnalysisResult(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } finally {
      setLoading(false);
    }
  };

  const saveEntry = async () => {
    if (!analysisResult || !currentUser) return;

    setLoading(true);
    setError(null);

    try {
      const moscowTime = getMoscowTime();
      const entryData = {
        ...analysisResult,
        image: imagePreview,
        timestamp: Timestamp.fromDate(moscowTime),
        userId: currentUser.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const entriesCollectionRef = collection(db, 'foodEntries');
      await addDoc(entriesCollectionRef, entryData);

      // Очистка формы
      setImagePreview(null);
      setAnalysisResult(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Ошибка при сохранении записи:', error);
      setError('Не удалось сохранить запись');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      {error && (
        <Alert severity="error" onClose={() => setError(null)} className="mb-4">
          {error}
        </Alert>
      )}

      <div className="space-y-6">
        {/* Daily Summary Card */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <h2 className="text-lg font-semibold mb-2">Ваша дневная норма</h2>
          <div className="mb-2">
            <div className="flex justify-between text-sm mb-1">
              <span>Калории: {totalStats.calories} из {dailyGoal}</span>
              <span>{Math.round(progressPercentage)}%</span>
            </div>
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-green-500 transition-all duration-500 ease-out" 
                style={{ width: `${progressPercentage}%` }}
              ></div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="bg-blue-50 p-2 rounded-lg">
              <div className="font-medium text-blue-600">{totalStats.protein}г</div>
              <div className="text-gray-500">Белки</div>
            </div>
            <div className="bg-purple-50 p-2 rounded-lg">
              <div className="font-medium text-purple-600">{totalStats.carbs}г</div>
              <div className="text-gray-500">Углеводы</div>
            </div>
            <div className="bg-yellow-50 p-2 rounded-lg">
              <div className="font-medium text-yellow-600">{totalStats.fat}г</div>
              <div className="text-gray-500">Жиры</div>
            </div>
          </div>
        </div>

        {/* Upload Section */}
        <div className="bg-white rounded-xl shadow-sm p-4 max-w-3xl mx-auto my-6">
          <h2 className="text-lg font-semibold mb-4">Анализ блюда по фото</h2>
          
          <div className="space-y-4">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                ref={fileInputRef}
                className="hidden"
                id="image-upload"
              />
              <label
                htmlFor="image-upload"
                className="cursor-pointer block"
              >
                {loading ? (
                  <div className="flex justify-center items-center h-48">
                    <CircularProgress />
                  </div>
                ) : imagePreview ? (
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="max-h-96 mx-auto rounded-lg"
                  />
                ) : (
                  <div className="text-gray-500">
                    <svg
                      className="mx-auto h-12 w-12 mb-2"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    <p>Нажмите для загрузки изображения</p>
                    <p className="text-sm mt-1">Поддерживаются форматы: JPG, PNG</p>
                  </div>
                )}
              </label>
            </div>

            {analysisResult && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-medium mb-2">{analysisResult.description || 'Блюдо не определено'}</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Калории: {analysisResult.calories || 0} ккал</p>
                    <p className="text-gray-600">Белки: {analysisResult.protein || 0}г</p>
                    <p className="text-gray-600">Жиры: {analysisResult.fat || 0}г</p>
                    <p className="text-gray-600">Углеводы: {analysisResult.carbs || 0}г</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Порция: {analysisResult.portionSize || 'Не определена'}</p>
                    <p className="text-gray-600">
                      Ингредиенты: {analysisResult.ingredients ? 
                        (Array.isArray(analysisResult.ingredients) ? 
                          analysisResult.ingredients.join(', ') : 
                          analysisResult.ingredients) 
                        : 'Не определены'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={saveEntry}
                  disabled={loading}
                  className="mt-4 w-full bg-green-500 text-white py-2 rounded hover:bg-green-600 disabled:opacity-50"
                >
                  {loading ? 'Сохранение...' : 'Сохранить'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Tips Section */}
        <div className="bg-gradient-to-r from-green-400 to-teal-400 rounded-xl p-4 text-white max-w-3xl mx-auto my-6">
          <h2 className="text-lg font-semibold mb-2">Совет дня</h2>
          <p className="text-sm opacity-90">
            {analysisResult?.advice || 'Добавляйте больше овощей в каждую трапезу. Они богаты клетчаткой и помогают чувствовать сытость дольше.'}
          </p>
        </div>

        {/* Image Modal */}
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
      </div>

      {/* Floating Action Button for mobile upload */}
      {!imagePreview && (
        <button
          onClick={() => fileInputRef.current.click()}
          className="fixed bottom-20 right-4 bg-green-500 text-white p-4 rounded-full shadow-lg hover:bg-green-600 transition-colors z-20"
        >
          <CameraIcon className="w-6 h-6" />
        </button>
      )}
    </Layout>
  );
}

function CameraIcon({ className = "h-6 w-6" }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}


