export default function parseAIMessage(text) {
  const lines = text.split('\n').map(line => line.trim());
  const result = {};

  for (let line of lines) {
    if (line.startsWith('- Название блюда:')) {
      result.description = line.replace('- Название блюда:', '').trim();
    }
    if (line.startsWith('- Ингредиенты:')) {
      result.ingredients = line.replace('- Ингредиенты:', '').split(',').map(i => i.trim()).filter(i => i).join(', ');
    }
    if (line.startsWith('- Масса:')) {
      let mass = line.replace('- Масса:', '').replace(/(грамм|грамма|граммов|грамма|грам|г)/gi, '').trim();
      const match = mass.match(/\d+/);
      result.portionSize = match ? `${match[0]} г` : '';
    }
    if (line.startsWith('- Калории:')) {
      const match = line.match(/\d+/);
      result.calories = match ? parseInt(match[0]) : 0;
    }
    if (line.startsWith('- Белки:')) {
      const match = line.replace('- Белки:', '').match(/\d+/);
      result.protein = match ? parseInt(match[0]) : 0;
    }
    if (line.startsWith('- Углеводы:')) {
      const match = line.replace('- Углеводы:', '').match(/\d+/);
      result.carbs = match ? parseInt(match[0]) : 0;
    }
    if (line.startsWith('- Жиры:')) {
      const match = line.replace('- Жиры:', '').match(/\d+/);
      result.fat = match ? parseInt(match[0]) : 0;
    }
    if (line.startsWith('- Совет:')) {
      result.advice = line.replace('- Совет:', '').trim();
    }
  }

  return {
    description: result.description || "Не определено",
    ingredients: result.ingredients || [],
    portionSize: result.portionSize || "Не определено",
    calories: result.calories || 0,
    protein: result.protein || 0,
    carbs: result.carbs || 0,
    fat: result.fat || 0,
    advice: result.advice || "Добавляйте больше овощей в каждую трапезу."
  };
}