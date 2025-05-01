export function LoadingComponent({ text = "Loading..." }: { text?: string }) {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
        <p className="mt-4">{text}</p>
      </div>
    </div>
  );
}

export function ErrorComponent({ message = "An error occurred" }: { message: string }) {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center p-6 max-w-sm mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-md">
        <div className="text-red-500 text-4xl mb-4">⚠️</div>
        <h2 className="text-xl font-bold mb-2">Error</h2>
        <p className="text-gray-600 dark:text-gray-400">{message}</p>
      </div>
    </div>
  );
} 