import { twMerge } from "tailwind-merge";

export default function TextInput({
  id,
  label,
  value,
  onChange,
  placeholder,
  inputType = "text",
  labelClassName,
  inputClassName,
  isTextArea = false,
}) {
  return (
    <>
      <label
        htmlFor={id}
        className={twMerge("text-sm text-slate-400", labelClassName)}
      >
        {label}
      </label>
      {isTextArea ? (
        <textarea
          id={id}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          className={twMerge(
            "p-2 rounded bg-slate-900 border border-white/10 text-white",
            inputClassName,
          )}
        />
      ) : (
        <input
          id={id}
          type={inputType}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          className={twMerge(
            "p-2 rounded bg-slate-900 border border-white/10 text-white",
            inputClassName,
          )}
        />
      )}
    </>
  );
}
