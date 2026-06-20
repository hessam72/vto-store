import Link from 'next/link';

const CATEGORIES = [
  { id: 'necklace', label: 'Necklace' },
  { id: 'earrings', label: 'Earrings' },
  { id: 'rings', label: 'Rings' },
  { id: 'watch', label: 'Watch' },
];

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-black">
      <div className="flex flex-col items-center gap-8">
        <h1 className="text-4xl font-bold text-black dark:text-white">
          Virtual Try-On
        </h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400">
          Select a jewelry category
        </p>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {CATEGORIES.map((cat) => (
            <Link
              key={cat.id}
              href={`/vto/${cat.id}`}
              className="px-6 py-3 bg-black text-white dark:bg-white dark:text-black rounded-lg font-medium hover:opacity-80 transition"
            >
              {cat.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
