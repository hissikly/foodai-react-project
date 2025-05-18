import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { doc, getDoc, updateDoc, serverTimestamp, setDoc, collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import Layout from './Layout';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const GOALS = [
  'Снижение веса',
  'Поддержание здоровья',
  'Своя цель',
];

export default function Profile() {
  const { currentUser, logout } = useAuth();
  const [profile, setProfile] = useState(null);
  const [goal, setGoal] = useState('Снижение веса');
  const [customGoal, setCustomGoal] = useState('');
  const [dailyGoal, setDailyGoal] = useState('2000');
  const [subscribed, setSubscribed] = useState(true);
  const [name, setName] = useState('');
  const [memberSince, setMemberSince] = useState('');
  const [loading, setLoading] = useState(true);
  const [gender, setGender] = useState('Женский');
  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [calorieNorm, setCalorieNorm] = useState('');
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [isEditingDailyGoal, setIsEditingDailyGoal] = useState(false);
  const [saveStatus, setSaveStatus] = useState({ type: '', message: '' });
  const [calculatedNorm, setCalculatedNorm] = useState(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [nutritionStats, setNutritionStats] = useState({
    avgCalories: 0,
    avgProtein: 0,
    avgCarbs: 0,
    avgFat: 0,
    caloriesByDay: [],
    dates: []
  });
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    if (!currentUser) return;
    const fetchProfile = async () => {
      const ref = doc(db, 'profiles', currentUser.uid);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data();
        setProfile(data);
        setGoal(data.goalText || 'Снижение веса');
        setCustomGoal(data.customGoal || '');
        setDailyGoal(data.dailyLimit ? String(data.dailyLimit) : '2000');
        setSubscribed(data.subscribed !== false);
        setName(data.name || currentUser.email);
        setGender(data.gender || 'Женский');
        setAge(data.age ? String(data.age) : '');
        setWeight(data.weight ? String(data.weight) : '');
        setHeight(
          typeof data.height === 'number' && data.height >= 0
            ? String(data.height)
            : ''
        );
        setCalorieNorm(data.calorieNorm ? String(data.calorieNorm) : '');
        if (data.createdAt && data.createdAt.toDate) {
          const months = Math.max(1, Math.floor((Date.now() - data.createdAt.toDate().getTime()) / (1000*60*60*24*30)));
          setMemberSince(`${months} месяц${months === 1 ? '' : months < 5 ? 'а' : 'ев'}`);
        } else {
          setMemberSince('—');
        }
      }
      setLoading(false);
    };
    fetchProfile();
  }, [currentUser]);

  const calculateNorm = () => {
    if (!weight || !height || !age) {
      setSaveStatus({ 
        type: 'error', 
        message: 'Пожалуйста, заполните все поля калькулятора' 
      });
      return;
    }

    setIsCalculating(true);
    let norm = 0;
    if (gender === 'Мужской') {
      norm = 10 * parseFloat(weight) + 6.25 * parseFloat(height) - 5 * parseInt(age) + 5;
    } else {
      norm = 10 * parseFloat(weight) + 6.25 * parseFloat(height) - 5 * parseInt(age);
    }
    norm = Math.max(300, Math.round(norm));
    setCalculatedNorm(norm);
    setIsCalculating(false);
  };

  const handleSave = async (customFields = {}) => {
    if (!currentUser) return;

    // Проверяем, есть ли хоть какая-то норма калорий
    const normToSave = customFields.calorieNorm !== undefined ? customFields.calorieNorm : (calculatedNorm || calorieNorm || dailyGoal);
    if (!normToSave) {
      setSaveStatus({
        type: 'error',
        message: 'Пожалуйста, рассчитайте или укажите норму калорий перед сохранением'
      });
      return;
    }

    setSaveStatus({ type: '', message: '' });
    setLoading(true);

    // Валидация данных
    const validAge = Math.max(1, parseInt(age) || 0);
    const validWeight = Math.max(1, parseFloat(weight) || 0);
    const validHeight = Math.max(0, parseFloat(height) || 0);

    // Используем значения из состояния или customFields
    const validGoal = customFields.goal !== undefined ? customFields.goal : goal;
    const validCustomGoal = customFields.customGoal !== undefined ? customFields.customGoal : customGoal;
    const validDailyGoal = customFields.dailyGoal !== undefined ? customFields.dailyGoal : (calculatedNorm || dailyGoal || calorieNorm);
    const validCalorieNorm = normToSave;

    try {
      const ref = doc(db, 'profiles', currentUser.uid);
      const docSnap = await getDoc(ref);

      const profileData = {
        goalText: validGoal,
        customGoal: validCustomGoal,
        dailyLimit: validDailyGoal,
        calorieNorm: validCalorieNorm,
        gender,
        age: validAge,
        weight: validWeight,
        height: validHeight,
        subscribed,
        updatedAt: serverTimestamp()
      };

      if (!docSnap.exists()) {
        await setDoc(ref, {
          ...profileData,
          createdAt: serverTimestamp(),
          userId: currentUser.uid,
          email: currentUser.email
        });
        setSaveStatus({ type: 'success', message: 'Профиль успешно создан' });
      } else {
        await updateDoc(ref, profileData);
        setSaveStatus({ type: 'success', message: 'Профиль успешно обновлен' });
      }

      setAge(String(validAge));
      setWeight(String(validWeight));
      setHeight(String(validHeight));
      setDailyGoal(String(validDailyGoal));
      setCalorieNorm(String(validCalorieNorm));
      setCalculatedNorm(null);
    } catch (error) {
      console.error('Ошибка при сохранении профиля:', error);
      setSaveStatus({
        type: 'error',
        message: 'Не удалось сохранить профиль. Пожалуйста, попробуйте еще раз.'
      });
    } finally {
      setLoading(false);
      setTimeout(() => {
        setSaveStatus({ type: '', message: '' });
      }, 3000);
    }
  };

  const handleGoalChange = (e) => {
    setGoal(e.target.value);
    if (e.target.value !== 'Своя цель') setCustomGoal('');
  };

  const handleGoalSave = () => {
    setIsEditingGoal(false);
    handleSave({ goal, customGoal });
  };

  const handleUnsubscribe = async () => {
    setSubscribed(false);
    if (currentUser) {
      const ref = doc(db, 'profiles', currentUser.uid);
      await updateDoc(ref, { subscribed: false });
    }
  };

  const handleDailyGoalChange = (e) => {
    const newValue = Math.max(300, parseInt(e.target.value) || 300).toString();
    setDailyGoal(newValue);
    setCalorieNorm(newValue);
  };

  const handleDailyGoalSave = () => {
    setIsEditingDailyGoal(false);
    handleSave({ dailyGoal, calorieNorm: dailyGoal });
  };

  // Функция для загрузки статистики питания
  const loadNutritionStats = async () => {
    if (!currentUser) return;
    
    try {
      setLoadingStats(true);
      const entriesCollectionRef = collection(db, 'foodEntries');
      const q = query(
        entriesCollectionRef,
        where('userId', '==', currentUser.uid),
        orderBy('timestamp', 'desc')
      );

      const querySnapshot = await getDocs(q);
      const entries = querySnapshot.docs.map(doc => ({
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate()
      }));

      // Группировка записей по дням
      const entriesByDay = entries.reduce((acc, entry) => {
        const date = entry.timestamp.toDateString();
        if (!acc[date]) {
          acc[date] = {
            calories: 0,
            protein: 0,
            carbs: 0,
            fat: 0,
            count: 0
          };
        }
        acc[date].calories += entry.calories || 0;
        acc[date].protein += entry.protein || 0;
        acc[date].carbs += entry.carbs || 0;
        acc[date].fat += entry.fat || 0;
        acc[date].count++;
        return acc;
      }, {});

      // Расчет средних значений
      const days = Object.keys(entriesByDay).length;
      const totals = Object.values(entriesByDay).reduce((acc, day) => ({
        calories: acc.calories + day.calories,
        protein: acc.protein + day.protein,
        carbs: acc.carbs + day.carbs,
        fat: acc.fat + day.fat
      }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

      // Подготовка данных для графика
      const sortedDates = Object.keys(entriesByDay).sort();
      const caloriesData = sortedDates.map(date => entriesByDay[date].calories);
      const formattedDates = sortedDates.map(date => {
        const d = new Date(date);
        return `${d.getDate()}.${d.getMonth() + 1}`;
      });

      setNutritionStats({
        avgCalories: Math.round(totals.calories / days),
        avgProtein: Math.round(totals.protein / days),
        avgCarbs: Math.round(totals.carbs / days),
        avgFat: Math.round(totals.fat / days),
        caloriesByDay: caloriesData,
        dates: formattedDates
      });
    } catch (error) {
      console.error('Ошибка при загрузке статистики:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    loadNutritionStats();
  }, [currentUser]);

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center items-center min-h-[300px]">
          Загрузка...
        </div>
      </Layout>
    );
  }

  // Аватар с инициалом
  const getInitial = (str) => str && str.length > 0 ? str[0].toUpperCase() : 'U';

  return (
    <Layout>
      <div className="min-h-screen bg-green-50 pt-8">
        <div className="bg-white rounded-xl shadow-sm p-4 w-full max-w-5xl mx-auto">
          {saveStatus.message && (
            <div className={`mb-4 p-3 rounded-lg ${
              saveStatus.type === 'success' 
                ? 'bg-green-100 text-green-700' 
                : 'bg-red-100 text-red-700'
            }`}>
              {saveStatus.message}
            </div>
          )}
          <h2 className="text-xl font-bold mb-4">Профиль</h2>
          <div className="flex items-center space-x-4 mb-6">
            <div className="w-16 h-16 rounded-full bg-green-200 flex items-center justify-center text-2xl font-bold text-green-700">
              {getInitial(currentUser.email)}
            </div>
            <div>
              <h3 className="font-semibold">{name}</h3>
              <p className="text-sm text-gray-500">{currentUser.email}</p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Цель */}
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700">Цель: </span>
              {isEditingGoal ? (
                <div className="flex items-center space-x-2">
                  <select
                    className="border rounded p-1"
                    value={goal}
                    onChange={handleGoalChange}
                  >
                    {GOALS.map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                  {goal === 'Своя цель' && (
                    <input
                      type="text"
                      className="border rounded p-1 flex-1"
                      placeholder="Ваша цель"
                      value={customGoal}
                      onChange={e => setCustomGoal(e.target.value)}
                    />
                  )}
                  <button 
                    className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm" 
                    onClick={handleGoalSave}
                  >
                    Сохранить
                  </button>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <span className="font-medium">{goal === 'Своя цель' && customGoal ? customGoal : goal}</span>
                  <button className="text-green-500 hover:underline text-sm font-medium" onClick={() => setIsEditingGoal(true)}>
                    Изменить
                  </button>
                </div>
              )}
            </div>
            {/* Дневной лимит */}
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700">Дневной лимит: </span>
              {isEditingDailyGoal ? (
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    className="border rounded p-1 w-32 text-right"
                    value={dailyGoal}
                    onChange={e => {
                      const val = Math.max(300, Math.min(10000, parseInt(e.target.value) || 300));
                      setDailyGoal(val.toString());
                      setCalorieNorm(val.toString());
                    }}
                    min="300"
                    max="10000"
                  />
                  <span>ккал</span>
                  <button 
                    className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm" 
                    onClick={handleDailyGoalSave}
                  >
                    Сохранить
                  </button>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <span className="font-medium">{dailyGoal} ккал</span>
                  <button className="text-green-500 hover:underline text-sm font-medium" onClick={() => setIsEditingDailyGoal(true)}>Изменить</button>
                </div>
              )}
            </div>
            {/* Рассылка */}
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700">Рассылка</span>
              <button className="px-3 py-1 border border-gray-300 rounded text-gray-400 bg-gray-100 cursor-not-allowed text-sm" disabled>Отписаться</button>
            </div>
            {/* Калькулятор нормы */}
            <div className="bg-gray-50 rounded-lg p-4 mt-6">
              <h3 className="text-base font-semibold mb-4 text-gray-700">Калькулятор нормы</h3>
              <div className="space-y-4">
                {/* Пол */}
                <div className="flex justify-between items-center">
                  <span className="text-gray-700">Пол:</span>
                  <select
                    className="border rounded p-1 ml-2"
                    value={gender}
                    onChange={e => setGender(e.target.value)}
                  >
                    <option value="Женский">Женский</option>
                    <option value="Мужской">Мужской</option>
                  </select>
                </div>
                {/* Возраст */}
                <div className="flex justify-between items-center">
                  <span className="text-gray-700">Возраст:</span>
                  <input
                    type="number"
                    className="border rounded p-1 ml-2 w-24 text-right"
                    value={age}
                    onChange={e => setAge(Math.max(1, Math.min(130, parseInt(e.target.value) || '')).toString())}
                    min="1"
                    max="130"
                    placeholder="лет"
                  />
                </div>
                {/* Вес */}
                <div className="flex justify-between items-center">
                  <span className="text-gray-700">Вес (кг):</span>
                  <input
                    type="number"
                    className="border rounded p-1 ml-2 w-24 text-right"
                    value={weight}
                    onChange={e => setWeight(Math.max(1, parseFloat(e.target.value) || '').toString())}
                    min="1"
                    step="0.1"
                    placeholder="кг"
                  />
                </div>
                {/* Рост */}
                <div className="flex justify-between items-center">
                  <span className="text-gray-700">Рост (см):</span>
                  <input
                    type="number"
                    className="border rounded p-1 ml-2 w-24 text-right"
                    value={height}
                    onChange={e => setHeight(Math.max(0, Math.min(300, parseFloat(e.target.value) || '')).toString())}
                    min="0"
                    max="300"
                    placeholder="см"
                  />
                </div>
                
                {/* Кнопки расчета и сохранения */}
                <div className="flex justify-between items-center mt-4 border-t pt-4">
                  <div className="flex-1">
                    <span className="text-gray-700">Норма калорий в день:</span>
                    <span className="font-medium ml-2">
                      {calculatedNorm ? `${calculatedNorm} ккал` : '—'}
                    </span>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={calculateNorm}
                      disabled={isCalculating || !age || !weight || !height}
                      className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isCalculating ? 'Расчет...' : 'Рассчитать'}
                    </button>
                    <button
                      onClick={() => handleSave()}
                      disabled={!calculatedNorm || loading}
                      className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? 'Сохранение...' : 'Установить как дневной лимит'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
            {/* Статистика питания */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold mb-4">Статистика питания в день</h3>
              
              {loadingStats ? (
                <div className="text-center py-4">Загрузка статистики...</div>
              ) : (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <div className="text-sm text-blue-600 mb-1">Средняя калорийность</div>
                      <div className="text-xl font-semibold text-blue-700">{nutritionStats.avgCalories} ккал</div>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg">
                      <div className="text-sm text-green-600 mb-1">Средний белок</div>
                      <div className="text-xl font-semibold text-green-700">{nutritionStats.avgProtein}г</div>
                    </div>
                    <div className="bg-purple-50 p-4 rounded-lg">
                      <div className="text-sm text-purple-600 mb-1">Средние углеводы</div>
                      <div className="text-xl font-semibold text-purple-700">{nutritionStats.avgCarbs}г</div>
                    </div>
                    <div className="bg-yellow-50 p-4 rounded-lg">
                      <div className="text-sm text-yellow-600 mb-1">Средний жир</div>
                      <div className="text-xl font-semibold text-yellow-700">{nutritionStats.avgFat}г</div>
                    </div>
                  </div>

                  <div className="mt-6">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Динамика калорийности</h4>
                    <div className="h-64">
                      <Line
                        data={{
                          labels: nutritionStats.dates,
                          datasets: [
                            {
                              label: 'Калории',
                              data: nutritionStats.caloriesByDay,
                              borderColor: 'rgb(34, 197, 94)',
                              backgroundColor: 'rgba(34, 197, 94, 0.1)',
                              tension: 0.4,
                              fill: true
                            }
                          ]
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: {
                            legend: {
                              display: false
                            }
                          },
                          scales: {
                            y: {
                              beginAtZero: true,
                              title: {
                                display: true,
                                text: 'Калории'
                              }
                            },
                            x: {
                              title: {
                                display: true,
                                text: 'Дата'
                              }
                            }
                          }
                        }}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="pt-4 border-t mt-4">
              <button
                className="w-full py-2 border border-red-300 text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                onClick={() => { handleSave(); logout(); }}
              >
                Выйти
              </button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

