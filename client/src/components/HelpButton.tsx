export default function HelpButton() {
  return (
    <a
      href="https://www.s-2international.com/contact"
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 bg-s2-red text-white px-6 py-3 rounded-full shadow-lg hover:bg-s2-red-dark transition-all flex items-center gap-2 z-40"
    >
      <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z"
        />
      </svg>
      <span className="font-semibold text-sm">Need Help? Contact Us</span>
    </a>
  );
}

