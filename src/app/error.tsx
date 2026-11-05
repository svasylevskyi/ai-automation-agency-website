"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="wrap section">
      <h1>We couldn’t load this page.</h1>
      <p>Please try again in a moment.</p>
      <button className="button" onClick={reset}>
        Try again
      </button>
      <p>
        <a href="/">Return to website</a>
      </p>
    </main>
  );
}
