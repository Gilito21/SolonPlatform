import { ReactNode } from "react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
}

export default function Modal({ isOpen, onClose, children }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div className="bg-gray-800 text-gray-200 p-4 rounded-lg shadow-lg max-w-sm w-full">
        {children}
        <button onClick={onClose} className="mt-4 px-4 py-2 bg-gray-700 text-gray-200 rounded">
          Close
        </button>
      </div>
    </div>
  );
}
