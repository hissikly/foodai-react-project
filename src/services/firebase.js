import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged
} from 'firebase/auth';
import { 
  initializeFirestore,
  enableIndexedDbPersistence,
  CACHE_SIZE_UNLIMITED,
  enableNetwork,
  disableNetwork,
  waitForPendingWrites
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID
};

// Добавляем проверку конфигурации
console.log('Firebase Config:', {
  ...firebaseConfig,
  apiKey: firebaseConfig.apiKey ? '***' : undefined // Скрываем API ключ в логах
});

// Проверяем наличие всех необходимых переменных
const requiredEnvVars = [
  'REACT_APP_FIREBASE_API_KEY',
  'REACT_APP_FIREBASE_AUTH_DOMAIN',
  'REACT_APP_FIREBASE_PROJECT_ID',
  'REACT_APP_FIREBASE_STORAGE_BUCKET',
  'REACT_APP_FIREBASE_MESSAGING_SENDER_ID'
];

const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingEnvVars.length > 0) {
  console.error('Отсутствуют следующие переменные окружения:', missingEnvVars);
}

// Инициализация Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Инициализация Firestore с настройками
const db = initializeFirestore(app, {
  cacheSizeBytes: CACHE_SIZE_UNLIMITED,
  ignoreUndefinedProperties: true,
  useFetchStreams: true, // Используем Fetch API вместо WebChannel
  experimentalMultiTabIndexedDbPersistence: true
});

// Функция для проверки состояния подключения
const checkConnection = async () => {
  try {
    await enableNetwork(db);
    console.log('Подключение к Firestore активно');
    return true;
  } catch (error) {
    console.error('Ошибка подключения к Firestore:', error);
    return false;
  }
};

// Функции для управления сетевым подключением
export const enableFirestoreNetwork = async () => {
  try {
    const isConnected = await checkConnection();
    if (!isConnected) {
      console.warn('Попытка восстановить подключение к Firestore...');
      await new Promise(resolve => setTimeout(resolve, 1000)); // Пауза перед повторной попыткой
      return await checkConnection();
    }
    return true;
  } catch (error) {
    console.error('Ошибка включения сетевого подключения:', error);
    if (error.code === 'failed-precondition') {
      console.warn('Попытка включить сетевое подключение, когда оно уже активно');
      return true;
    }
    return false;
  }
};

export const disableFirestoreNetwork = async () => {
  try {
    await disableNetwork(db);
    console.log('Сетевое подключение Firestore отключено');
    return true;
  } catch (error) {
    console.error('Ошибка отключения сетевого подключения:', error);
    if (error.code === 'failed-precondition') {
      console.warn('Попытка отключить сетевое подключение, когда оно уже отключено');
      return true;
    }
    return false;
  }
};

// Включаем офлайн-персистентность
let persistenceEnabled = false;
const enablePersistence = async () => {
  if (!persistenceEnabled) {
    try {
      // Проверяем подключение перед включением персистентности
      const isConnected = await checkConnection();
      if (!isConnected) {
        console.warn('Нет подключения к Firestore, откладываем включение персистентности');
        return;
      }

      await enableIndexedDbPersistence(db, {
        synchronizeTabs: true,
        forceOwningTab: true // Принудительно делаем текущую вкладку владельцем
      });
      persistenceEnabled = true;
      console.log('Офлайн-персистентность включена с поддержкой многопользовательского доступа');
      
      // Ждем завершения всех ожидающих записей
      try {
        await waitForPendingWrites(db);
        console.log('Все ожидающие записи завершены');
      } catch (error) {
        if (error.code === 'failed-precondition') {
          console.warn('Не удалось дождаться завершения записей из-за многопользовательского доступа');
        } else {
          console.warn('Ошибка при ожидании записей:', error);
        }
      }
    } catch (err) {
      if (err.code === 'failed-precondition') {
        console.warn('Офлайн-персистентность уже включена в другой вкладке');
        // Пробуем переподключиться
        await checkConnection();
      } else if (err.code === 'unimplemented') {
        console.warn('Текущий браузер не поддерживает офлайн-персистентность');
      } else {
        console.error('Ошибка при включении офлайн-персистентности:', err);
        // Пробуем переподключиться через некоторое время
        setTimeout(async () => {
          await checkConnection();
        }, 5000);
      }
    }
  }
};

// Включаем персистентность после успешной аутентификации
onAuthStateChanged(auth, async (user) => {
  if (user) {
    await enablePersistence();
    // Проверяем и включаем сетевое подключение
    await enableFirestoreNetwork();
  }
});

const googleProvider = new GoogleAuthProvider();

export const login = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    await enablePersistence();
    await enableFirestoreNetwork();
    return userCredential;
  } catch (error) {
    console.error("Ошибка входа:", error);
    throw error;
  }
};

export const register = async (email, password) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    await enablePersistence();
    await enableFirestoreNetwork();
    return userCredential;
  } catch (error) {
    console.error("Ошибка регистрации:", error);
    throw error;
  }
};

export const loginWithGoogle = async () => {
  try {
    const userCredential = await signInWithPopup(auth, googleProvider);
    await enablePersistence();
    await enableFirestoreNetwork();
    return userCredential;
  } catch (error) {
    console.error("Ошибка входа через Google:", error);
    throw error;
  }
};

export { auth, db };
