// Урок на входе. «Начать урок» — один открытый урок; пока он не закончен,
// всё добавленное привязывается к нему. Повторный «начать» не плодит уроков:
// на занятии некогда разбираться, нажала ли уже.
import { Lesson } from "./models.js";
import { today } from "./models.js";

export function currentLesson() {
  return Lesson.findOne({ where: { finishedAt: null }, order: [["id", "DESC"]] });
}

export async function startLesson({ date, title } = {}) {
  const open = await currentLesson();
  if (open) return open;
  return Lesson.create({
    date: /^\d{4}-\d{2}-\d{2}$/.test(String(date ?? "")) ? date : today(),
    title: typeof title === "string" ? title.trim().slice(0, 200) : "",
    // Явно: клиент судит «идёт ли урок» по finishedAt === null, а не по undefined.
    finishedAt: null,
  });
}

export async function finishLesson(id) {
  const lesson = await Lesson.findByPk(id);
  if (!lesson) throw new Error("Урок не найден");
  if (lesson.finishedAt) throw new Error("Урок уже закончен");
  lesson.finishedAt = new Date();
  await lesson.save();
  return lesson;
}
