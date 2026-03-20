'use client';

import { useState } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const [question, setQuestion] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [queryLoading, setQueryLoading] = useState<boolean>(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setUploadStatus('Please select a file first.');
      return;
    }

    setLoading(true);
    setUploadStatus('Uploading...');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('http://localhost:8000/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (response.ok) {
        setUploadStatus(data.message);
      } else {
        setUploadStatus(`Error: ${data.detail}`);
      }
    } catch (error) {
      setUploadStatus('Error uploading file.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleQuery = async () => {
    if (!question.trim()) return;

    const userMessage: Message = { role: 'user', content: question };
    setMessages((prev) => [...prev, userMessage]);
    setQuestion('');
    setQueryLoading(true);

    try {
      const response = await fetch('http://localhost:8000/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: userMessage.content }),
      });

      const data = await response.json();
      if (response.ok) {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.answer }]);
      } else {
        setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${data.detail}` }]);
      }
    } catch (error) {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Error querying the model.' }]);
      console.error(error);
    } finally {
      setQueryLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900 p-8">
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-lg p-8">
        <h1 className="text-3xl font-bold mb-8 text-blue-600 text-center">PDF RAG Application</h1>

        {/* Step 1: Upload Section */}
        <div className="mb-10 p-6 border-2 border-dashed border-blue-100 rounded-xl bg-blue-50/50">
          <h2 className="text-xl font-semibold mb-4 text-blue-800">Step 1: Upload your PDF</h2>
          <div className="flex flex-col gap-4">
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500
                file:mr-4 file:py-2.5 file:px-6
                file:rounded-full file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-600 file:text-white
                hover:file:bg-blue-700 transition-all"
            />
            <button
              onClick={handleUpload}
              disabled={loading}
              className={`py-2.5 px-6 rounded-full font-bold text-white transition-all
                ${loading ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700 shadow-md hover:shadow-lg'}`}
            >
              {loading ? 'Processing...' : 'Upload & Start Indexing'}
            </button>
            {uploadStatus && (
              <p className={`text-sm mt-2 font-medium ${uploadStatus.includes('Error') ? 'text-red-500' : 'text-green-600'}`}>
                {uploadStatus}
              </p>
            )}
          </div>
        </div>

        {/* Step 2: Chat Interface */}
        <div className="p-6 border border-gray-100 rounded-xl bg-gray-50/50 min-h-[400px] flex flex-col">
          <h2 className="text-xl font-semibold mb-6 text-blue-800">Step 2: Ask Questions</h2>

          <div className="flex-grow overflow-y-auto mb-6 space-y-4 pr-2">
            {messages.length === 0 && (
              <p className="text-gray-400 text-center mt-10">Your conversation will appear here...</p>
            )}
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`p-4 rounded-2xl max-w-[85%] ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white self-end ml-auto shadow-sm'
                    : 'bg-white border border-blue-100 text-gray-800 self-start shadow-sm'
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            ))}
            {queryLoading && (
              <div className="bg-white border border-blue-100 text-gray-800 self-start p-4 rounded-2xl animate-pulse shadow-sm">
                Thinking...
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleQuery()}
              placeholder="Ask a question about the PDF..."
              className="flex-grow p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
            <button
              onClick={handleQuery}
              disabled={queryLoading || !question.trim()}
              className={`px-6 py-3 rounded-xl font-bold text-white transition-all
                ${queryLoading || !question.trim() ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700 shadow-md'}`}
            >
              Ask
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
