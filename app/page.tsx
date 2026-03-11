export default function Home() {
  return (
    <main className="min-h-screen">
      <section className="bg-gradient-to-b from-amber-300 to-orange-500 px-6 py-20 md:py-28">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-10 text-center">
          <h1 className="text-6xl font-medium tracking-tight text-black md:text-8xl">
            What&apos;s the Call?
          </h1>

          <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-14">
            <button
              type="button"
              className="rounded-full border border-gray-500 bg-gray-200 px-10 py-2 text-4xl/none text-black shadow-sm transition hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
            >
              Sign Up
            </button>
            <button
              type="button"
              className="rounded-full border border-gray-500 bg-gray-200 px-10 py-2 text-4xl/none text-black shadow-sm transition hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
            >
              Login In
            </button>
          </div>
        </div>
      </section>

      <section className="bg-gray-200 px-5 py-7 md:px-8 md:py-8">
        <div className="mx-auto max-w-7xl">
          <h2 className="mb-2 text-center text-5xl text-gray-600 md:text-6xl">About</h2>
          <p className="text-2xl/normal text-black md:text-5xl/normal">
            <strong>What&apos;s The Call</strong> is a community project for fencing referees and enthusiasts to
            review actions and share their decisions. Users watch short clips from bouts and submit their
            calls, helping build a dataset of how different referees interpret priority and right-of-way. By
            collecting many perspectives on the same actions, the project aims to better understand how
            refereeing decisions are made and how conventions are applied in practice.
          </p>
        </div>
      </section>
    </main>
  );
}