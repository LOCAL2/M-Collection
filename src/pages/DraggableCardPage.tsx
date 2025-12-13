import { useState, useCallback, useEffect } from "react";
import {
  DraggableCardBody,
  DraggableCardContainer,
} from "../components/ui/draggable-card";

interface Props {
  onClose: () => void;
  theme?: "light" | "dark";
  images?: string[];
}

interface CardItem {
  id: number;
  imageUrl: string;
  position: { top: string; left: string; rotate: string };
}

// สร้าง random position สำหรับการ์ดเดียว
const generateRandomPosition = () => {
  const top = 15 + Math.random() * 55; // 15% - 70%
  const left = 10 + Math.random() * 70; // 10% - 80%
  const rotation = Math.random() * 24 - 12; // -12 to 12 deg

  return {
    top: `${top}%`,
    left: `${left}%`,
    rotate: `${rotation}deg`,
  };
};

// สุ่มเลือกรูปจาก array
const getRandomImage = (images: string[]) => {
  return images[Math.floor(Math.random() * images.length)];
};

let cardIdCounter = 0;

export default function DraggableCardPage({
  onClose,
  theme = "dark",
  images,
}: Props) {
  const [cards, setCards] = useState<CardItem[]>([]);

  // สร้างการ์ดเริ่มต้น
  useEffect(() => {
    if (images && images.length > 0) {
      const initialCards: CardItem[] = [];
      const cardCount = Math.min(12, images.length);

      for (let i = 0; i < cardCount; i++) {
        initialCards.push({
          id: cardIdCounter++,
          imageUrl: getRandomImage(images),
          position: generateRandomPosition(),
        });
      }

      setCards(initialCards);
    }
  }, [images]);

  // เมื่อการ์ดถูกโยนออกไป - สร้างการ์ดใหม่ทดแทน
  const handleCardThrow = useCallback(
    (cardId: number) => {
      if (!images || images.length === 0) return;

      // สร้างการ์ดใหม่ทดแทน
      const newCard: CardItem = {
        id: cardIdCounter++,
        imageUrl: getRandomImage(images),
        position: generateRandomPosition(),
      };

      setCards((prev) => {
        // ลบการ์ดเก่าและเพิ่มการ์ดใหม่
        const filtered = prev.filter((c) => c.id !== cardId);
        return [...filtered, newCard];
      });
    },
    [images],
  );

  return (
    <div
      className={`fixed inset-0 z-50 overflow-hidden ${
        theme === "light" ? "bg-slate-50" : "bg-slate-950"
      }`}
      style={{
        backgroundImage:
          theme === "light"
            ? "linear-gradient(rgba(148, 163, 184, 0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(148, 163, 184, 0.4) 1px, transparent 1px)"
            : "linear-gradient(rgba(148, 163, 184, 0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(148, 163, 184, 0.08) 1px, transparent 1px)",
        backgroundSize: "25px 25px",
      }}
    >
      {/* Header */}
      <header
        className={`absolute top-0 left-0 right-0 backdrop-blur-md border-b z-30 ${
          theme === "light"
            ? "bg-white/80 border-slate-200/50"
            : "bg-slate-900/80 border-slate-700/50"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  theme === "dark" ? "bg-pink-500" : "bg-pink-600"
                }`}
              >
                <svg
                  className="w-4 h-4 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
                  />
                </svg>
              </div>
              <div>
                <h1
                  className={`font-semibold ${
                    theme === "light" ? "text-slate-900" : "text-white"
                  }`}
                >
                  Cards
                </h1>
                <p
                  className={`text-xs ${
                    theme === "light" ? "text-slate-500" : "text-slate-400"
                  }`}
                >
                  {cards.length} cards • {images?.length || 0} images
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                theme === "light"
                  ? "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  : "text-slate-300 hover:text-white hover:bg-slate-800"
              }`}
            >
              Close
            </button>
          </div>
        </div>
      </header>

      {/* Cards Container */}
      <DraggableCardContainer className="relative flex min-h-screen w-full items-center justify-center overflow-clip pt-14">
        {/* Center Text */}
        <p
          className={`absolute top-1/2 mx-auto max-w-md -translate-y-1/2 text-center text-2xl font-black md:text-4xl px-4 ${
            theme === "light" ? "text-slate-300" : "text-slate-800"
          }`}
        >
          Throw the cards away
        </p>

        {/* Cards */}
        {cards.map((card) => (
          <DraggableCardBody
            key={card.id}
            className={`absolute !p-0 !min-h-0 !w-auto ${
              theme === "light" ? "bg-white" : "bg-slate-800"
            }`}
            style={{
              top: card.position.top,
              left: card.position.left,
              transform: `rotate(${card.position.rotate})`,
            }}
            onThrow={() => handleCardThrow(card.id)}
          >
            <img
              src={card.imageUrl}
              alt={`Card ${card.id}`}
              className="pointer-events-none relative z-10 h-48 w-48 sm:h-56 sm:w-56 md:h-64 md:w-64 object-cover rounded-md select-none"
              draggable={false}
            />
          </DraggableCardBody>
        ))}

        {(!images || images.length === 0) && (
          <div
            className={`text-center ${
              theme === "light" ? "text-slate-500" : "text-slate-400"
            }`}
          >
            <p className="text-lg">ไม่มีรูปภาพในแกลเลอรี่</p>
            <p className="text-sm mt-2">อัปโหลดรูปภาพเพื่อดู Draggable Cards</p>
          </div>
        )}
      </DraggableCardContainer>
    </div>
  );
}
