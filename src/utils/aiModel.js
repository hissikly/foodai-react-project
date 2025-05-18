export const analyzeFoodImage = async (imageFile) => {
  const user_query = `Ты диетолог, тебе нужно точно определять калории.
Проанализируй изображение еды и ответь на вопросы:
1. Что за блюдо на картинке? Перечисли все ингредиенты.
2. Оцени массу порции в граммах без текста в граммах.
3. Подсчитай примерную калорийность и БЖУ.
4. Добавь полезный совет по питанию.
Формат вывода:
- Название блюда:
- Ингредиенты:
- Масса:
- Калории:
- Белки:
- Жиры:
- Углеводы:
- Совет:`;

  try {
    const imageBase64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = error => reject(error);
      reader.readAsDataURL(imageFile);
    });

    const imageUrl = `data:${imageFile.type};base64,${imageBase64}`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.REACT_APP_OPENROUTER_API_KEY}`,
        "HTTP-Referer": process.env.REACT_APP_APP_URL,
        "X-Title": "NutriVision",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "qwen/qwen2.5-vl-72b-instruct:free",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: user_query },
              { type: "image_url", image_url: { url: imageUrl } }
            ]
          }
        ],
        max_tokens: 500
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Ошибка API: ${JSON.stringify(data)}`);
    }

    return data.choices?.[0]?.message?.content || "";
  } catch (error) {
    console.error("❌ Ошибка при анализе:", error);
    throw error;
  }
}; 