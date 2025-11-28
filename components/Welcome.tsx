import React, { useEffect, useState } from 'react';

interface WelcomeProps {
  onComplete: () => void;
}

const Welcome: React.FC<WelcomeProps> = ({ onComplete }) => {
  const text = "Welcome to Mama Ai...";
  const [displayedText, setDisplayedText] = useState("");

  useEffect(() => {
    let index = 0;
    const intervalId = setInterval(() => {
      setDisplayedText(text.slice(0, index + 1));
      index++;
      if (index === text.length) {
        clearInterval(intervalId);
        setTimeout(onComplete, 1500); // Wait 1.5s after typing finishes
      }
    }, 100);

    return () => clearInterval(intervalId);
  }, [onComplete]);

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black z-50">
      <h1 className="text-4xl md:text-6xl font-bold text-[#FFD700] typewriter-cursor text-center px-4">
        {displayedText}
      </h1>
    </div>
  );
};

export default Welcome;