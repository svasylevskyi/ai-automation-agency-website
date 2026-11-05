"use client";
export default function AdminError({ reset }: { reset: () => void }) {
  return (
    <main className="admin-main">
      <div className="admin-card">
        <h1>The owner area couldn’t load.</h1>
        <p>
          Check that the database is running and migrations have completed, then
          try again.
        </p>
        <button className="button" onClick={reset}>
          Try again
        </button>
      </div>
    </main>
  );
}
