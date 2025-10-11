export default function Button({ children, className = "", ...props }) {
  return (
    <button
      {...props}
      className={
        "bg-yellow-500 text-black text-lg px-6 py-3 rounded-2xl shadow-lg hover:bg-yellow-400 " +
        className
      }
    >
      {children}
    </button>
  );
}
