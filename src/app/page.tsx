const steps = [
  {
    title: "Describe your idea",
    body: "Tell Claude what your business does and who it serves — in plain English. No tech jargon needed.",
  },
  {
    title: "See it built",
    body: "Claude writes the code and designs the interface, then shows you a working website and app.",
  },
  {
    title: "Refine together",
    body: "Point at anything — colors, wording, a button, a whole feature — and Claude reshapes it until it feels right.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-zinc-50 font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      {/* Hero */}
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-6 py-24 text-center">
        <span className="mb-6 inline-flex items-center rounded-full border border-zinc-200 bg-white px-4 py-1.5 text-sm font-medium text-zinc-600 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
          ● Foundation ready
        </span>

        <h1 className="max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">
          Your business idea,
          <br />
          turned into a real product.
        </h1>

        <p className="mt-6 max-w-xl text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          This is the starting foundation for your website and app. Describe
          your idea, and the homepage, pages, and features below will be built
          around it.
        </p>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <span className="flex h-12 items-center justify-center rounded-full bg-zinc-900 px-7 text-base font-medium text-white dark:bg-white dark:text-zinc-900">
            Next: tell Claude your idea
          </span>
          <span className="flex h-12 items-center justify-center rounded-full border border-zinc-300 px-7 text-base font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300">
            Built with Next.js + Tailwind
          </span>
        </div>

        {/* Steps */}
        <div className="mt-20 grid w-full gap-6 sm:grid-cols-3">
          {steps.map((step, i) => (
            <div
              key={step.title}
              className="rounded-2xl border border-zinc-200 bg-white p-6 text-left shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-full bg-zinc-900 text-sm font-semibold text-white dark:bg-white dark:text-zinc-900">
                {i + 1}
              </div>
              <h3 className="text-lg font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                {step.body}
              </p>
            </div>
          ))}
        </div>
      </main>

      <footer className="border-t border-zinc-200 py-6 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-500">
        A starting point — ready to become your product.
      </footer>
    </div>
  );
}
