"use client";

// Small editors shared by the lesson form.
//
// Every list here is "rows the teacher can add, reorder-by-deleting and edit
// in place". Writing one generic component for strings, one for pairs and one
// for questions is less code than three bespoke forms and, more usefully,
// makes them behave identically — the same add button in the same place.

import { Plus, Trash2 } from "lucide-react";

export function StringListEditor({
  label,
  hint,
  value,
  onChange,
  multiline = false,
  placeholder,
}: {
  label: string;
  hint?: string;
  value: string[];
  onChange: (next: string[]) => void;
  multiline?: boolean;
  placeholder?: string;
}) {
  const set = (i: number, v: string) => onChange(value.map((x, j) => (j === i ? v : x)));
  const remove = (i: number) => onChange(value.filter((_, j) => j !== i));

  return (
    <fieldset className="space-y-2">
      <legend className="text-micro uppercase tracking-wider text-slate-500">{label}</legend>
      {hint && <p className="text-micro text-slate-500 dark:text-slate-400">{hint}</p>}
      {value.map((item, i) =>
        multiline ? (
          <div key={i} className="flex gap-2">
            <textarea
              value={item}
              onChange={(e) => set(i, e.target.value)}
              rows={3}
              placeholder={placeholder}
              aria-label={`${label} ${i + 1}`}
              className="input-glow w-full"
            />
            <RemoveButton onClick={() => remove(i)} label={`${label} ${i + 1}`} />
          </div>
        ) : (
          <div key={i} className="flex gap-2">
            <input
              value={item}
              onChange={(e) => set(i, e.target.value)}
              placeholder={placeholder}
              aria-label={`${label} ${i + 1}`}
              className="input-glow w-full"
            />
            <RemoveButton onClick={() => remove(i)} label={`${label} ${i + 1}`} />
          </div>
        )
      )}
      <AddButton onClick={() => onChange([...value, ""])} />
    </fieldset>
  );
}

export function PairListEditor({
  label,
  hint,
  leftLabel,
  rightLabel,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  leftLabel: string;
  rightLabel: string;
  value: { left: string; right: string }[];
  onChange: (next: { left: string; right: string }[]) => void;
}) {
  const set = (i: number, key: "left" | "right", v: string) =>
    onChange(value.map((x, j) => (j === i ? { ...x, [key]: v } : x)));

  return (
    <fieldset className="space-y-2">
      <legend className="text-micro uppercase tracking-wider text-slate-500">{label}</legend>
      {hint && <p className="text-micro text-slate-500 dark:text-slate-400">{hint}</p>}
      {value.map((pair, i) => (
        <div key={i} className="flex flex-col gap-2 sm:flex-row">
          <input
            value={pair.left}
            onChange={(e) => set(i, "left", e.target.value)}
            placeholder={leftLabel}
            aria-label={`${leftLabel} ${i + 1}`}
            className="input-glow w-full sm:w-1/3"
          />
          <input
            value={pair.right}
            onChange={(e) => set(i, "right", e.target.value)}
            placeholder={rightLabel}
            aria-label={`${rightLabel} ${i + 1}`}
            className="input-glow w-full flex-1"
          />
          <RemoveButton
            onClick={() => onChange(value.filter((_, j) => j !== i))}
            label={`${label} ${i + 1}`}
          />
        </div>
      ))}
      <AddButton onClick={() => onChange([...value, { left: "", right: "" }])} />
    </fieldset>
  );
}

export interface EditableQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export function QuizEditor({
  value,
  onChange,
}: {
  value: EditableQuestion[];
  onChange: (next: EditableQuestion[]) => void;
}) {
  const set = (i: number, patch: Partial<EditableQuestion>) =>
    onChange(value.map((q, j) => (j === i ? { ...q, ...patch } : q)));

  return (
    <fieldset className="space-y-4">
      <legend className="text-micro uppercase tracking-wider text-slate-500">
        Викторина сұрақтары
      </legend>
      <p className="text-micro text-slate-500 dark:text-slate-400">
        Дұрыс жауапты радио түймемен белгілеңіз. Сұрақтар «Жылдам жауап» пен «Айналмалы
        дөңгелек» ойындарында да қолданылады.
      </p>

      {value.map((q, i) => (
        <div key={q.id} className="rounded-2xl border border-slate-200/70 p-4 dark:border-white/10">
          <div className="flex items-start gap-2">
            <span className="data-num mt-2.5 text-micro text-slate-500">{i + 1}.</span>
            <textarea
              value={q.question}
              onChange={(e) => set(i, { question: e.target.value })}
              rows={2}
              placeholder="Сұрақ мәтіні"
              aria-label={`Сұрақ ${i + 1}`}
              className="input-glow w-full"
            />
            <RemoveButton
              onClick={() => onChange(value.filter((_, j) => j !== i))}
              label={`Сұрақ ${i + 1}`}
            />
          </div>

          <div className="mt-3 space-y-2 pl-6">
            {q.options.map((opt, oi) => (
              <label key={oi} className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`correct-${q.id}`}
                  checked={q.correctIndex === oi}
                  onChange={() => set(i, { correctIndex: oi })}
                  aria-label={`${i + 1}-сұрақтың ${oi + 1}-нұсқасы дұрыс`}
                  className="shrink-0 accent-brand-500"
                />
                <input
                  value={opt}
                  onChange={(e) =>
                    set(i, { options: q.options.map((o, j) => (j === oi ? e.target.value : o)) })
                  }
                  placeholder={`${oi + 1}-нұсқа`}
                  aria-label={`Сұрақ ${i + 1}, нұсқа ${oi + 1}`}
                  className="input-glow w-full"
                />
              </label>
            ))}
          </div>

          <textarea
            value={q.explanation}
            onChange={(e) => set(i, { explanation: e.target.value })}
            rows={2}
            placeholder="Түсіндірме — дұрыс жауаптан кейін көрсетіледі"
            aria-label={`Сұрақ ${i + 1} түсіндірмесі`}
            className="input-glow mt-3 w-full"
          />
        </div>
      ))}

      <AddButton
        onClick={() =>
          onChange([
            ...value,
            {
              id: `q_${Math.random().toString(36).slice(2, 9)}`,
              question: "",
              options: ["", "", "", ""],
              correctIndex: 0,
              explanation: "",
            },
          ])
        }
      />
    </fieldset>
  );
}

function AddButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="btn-ghost text-sm">
      <Plus size={15} /> Жол қосу
    </button>
  );
}

function RemoveButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${label} — жою`}
      className="btn-ghost shrink-0 self-start text-slate-400 hover:text-rose-300"
    >
      <Trash2 size={15} />
    </button>
  );
}
