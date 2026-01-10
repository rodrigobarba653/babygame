"use client";

import { useState, useRef, useEffect } from "react";
import type { RoomState } from "@/lib/realtime/types";
import Timer from "./Timer";

interface PictionaryProps {
  roomState: RoomState;
  isHost: boolean;
  userId: string;
  onGuessSubmit: (text: string) => void;
  onPickWinner: (
    winnerUserId: string,
    awardType: "closest" | "funniest"
  ) => void;
  onStrokeBatch: (
    points: Array<{ x: number; y: number }>,
    color: string,
    width: number,
    isStart?: boolean,
    isEnd?: boolean
  ) => void;
  onContinueToNextRound?: () => void;
  onRevealGender?: () => void;
  receivedStrokes?: Array<{
    points: Array<{ x: number; y: number }>;
    color: string;
    width: number;
  }>;
}

export default function Pictionary({
  roomState,
  isHost,
  userId,
  onGuessSubmit,
  onPickWinner,
  onStrokeBatch,
  onContinueToNextRound,
  onRevealGender,
  receivedStrokes = [],
}: PictionaryProps) {
  // Hooks must be called before any early returns
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [guessText, setGuessText] = useState("");
  const [strokeBuffer, setStrokeBuffer] = useState<
    Array<{ x: number; y: number }>
  >([]);
  const [drawerStrokes, setDrawerStrokes] = useState<
    Array<{
      points: Array<{ x: number; y: number }>;
      color: string;
      width: number;
    }>
  >([]);

  const pictionary = roomState.pictionary;
  const isDrawer = pictionary ? userId === pictionary.drawerUserId : false;

  // Find drawer's name for display
  const drawer = pictionary
    ? roomState.players.find((p) => p.userId === pictionary.drawerUserId)
    : null;
  const drawerName = drawer?.name || "Unknown";

  // Drawing logic
  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#000000";
  }, []);

  // Clear drawer strokes when turn index changes (new round)
  useEffect(() => {
    if (!pictionary) return;
    setDrawerStrokes([]);
  }, [pictionary?.turnIndex, pictionary]);

  // Clear and re-render canvas when turn changes or strokes update
  useEffect(() => {
    if (!canvasRef.current || !pictionary) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    // Always clear canvas first - this ensures clean state for new turns
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

    // Render drawings if we're in draw, guess, or reveal phase
    // This keeps the drawing visible during guess and reveal phases
    const shouldShowDrawing =
      roomState.phase === "pictionary_draw" ||
      roomState.phase === "pictionary_guess" ||
      roomState.phase === "pictionary_reveal";

    if (shouldShowDrawing) {
      const rect = canvasRef.current.getBoundingClientRect();
      const scaleX =
        canvasRef.current.width / rect.width / window.devicePixelRatio;
      const scaleY =
        canvasRef.current.height / rect.height / window.devicePixelRatio;

      // For drawer: render their own strokes
      // For non-drawer: render received strokes
      const strokesToRender = isDrawer ? drawerStrokes : receivedStrokes;

      if (strokesToRender.length > 0) {
        strokesToRender.forEach((stroke) => {
          if (!stroke.points || stroke.points.length < 2) return;
          ctx.beginPath();
          ctx.strokeStyle = stroke.color;
          ctx.lineWidth = stroke.width;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          ctx.moveTo(stroke.points[0].x * scaleX, stroke.points[0].y * scaleY);
          for (let i = 1; i < stroke.points.length; i++) {
            ctx.lineTo(
              stroke.points[i].x * scaleX,
              stroke.points[i].y * scaleY
            );
          }
          ctx.stroke();
        });
      }
    }
  }, [
    roomState.phase,
    pictionary?.turnIndex,
    receivedStrokes,
    drawerStrokes,
    isDrawer,
    pictionary,
  ]);

  // Throttled stroke batch sender
  useEffect(() => {
    if (strokeBuffer.length > 0 && !isDrawing) {
      const timer = setTimeout(() => {
        if (strokeBuffer.length > 0) {
          onStrokeBatch(strokeBuffer, "#000000", 4);
          // Also store in drawer strokes for local rendering
          setDrawerStrokes((prevStrokes) => [
            ...prevStrokes,
            { points: strokeBuffer, color: "#000000", width: 4 },
          ]);
          setStrokeBuffer([]);
        }
      }, 100);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [strokeBuffer, isDrawing, onStrokeBatch]);

  // Early return after all hooks
  if (!pictionary) return null;

  const getPointFromEvent = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    if (!canvasRef.current) return null;
    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = "clientX" in e ? e.clientX : e.touches[0].clientX;
    const clientY = "clientY" in e ? e.clientY : e.touches[0].clientY;
    const x =
      (clientX - rect.left) *
      (canvasRef.current.width / rect.width / window.devicePixelRatio);
    const y =
      (clientY - rect.top) *
      (canvasRef.current.height / rect.height / window.devicePixelRatio);
    return { x, y };
  };

  const handleStartDraw = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    if (!isDrawer || roomState.phase !== "pictionary_draw") return;
    e.preventDefault();
    const point = getPointFromEvent(e);
    if (!point) return;

    setIsDrawing(true);
    setStrokeBuffer([point]);
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(point.x, point.y);
    }
  };

  const handleDraw = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    if (!isDrawer || !isDrawing || roomState.phase !== "pictionary_draw")
      return;
    e.preventDefault();
    const point = getPointFromEvent(e);
    if (!point) return;

    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) {
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
    }

    setStrokeBuffer((prev) => {
      const newBuffer = [...prev, point];
      if (newBuffer.length >= 5) {
        // Send batch every 5 points
        onStrokeBatch(newBuffer, "#000000", 4);
        // Also store in drawer strokes for local rendering
        setDrawerStrokes((prevStrokes) => [
          ...prevStrokes,
          { points: newBuffer, color: "#000000", width: 4 },
        ]);
        return [];
      }
      return newBuffer;
    });
  };

  const handleEndDraw = () => {
    if (!isDrawer || !isDrawing) return;
    setIsDrawing(false);
    if (strokeBuffer.length > 0) {
      onStrokeBatch(strokeBuffer, "#000000", 4, false, true);
      // Also store in drawer strokes for local rendering
      setDrawerStrokes((prevStrokes) => [
        ...prevStrokes,
        { points: strokeBuffer, color: "#000000", width: 4 },
      ]);
      setStrokeBuffer([]);
    }
  };

  const handleGuessSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guessText.trim() || roomState.phase !== "pictionary_guess") return;
    onGuessSubmit(guessText.trim());
    setGuessText("");
  };

  return (
    <div className="max-w-6xl mx-auto px-4">
      <div className="bg-white rounded-lg shadow-xl p-4 sm:p-8">
        <div className="mb-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-2">
            <div className="text-sm text-gray-500 text-center md:text-left">
              Round {pictionary.turnIndex + 1} - Pictionary
            </div>
            {/* Show drawer indicator during drawing phase */}
            {roomState.phase === "pictionary_draw" && (
              <div className="bg-purple-50 border-2 border-purple-300 rounded-lg px-4 py-2 shadow-sm">
                <p className="text-purple-800 font-bold text-sm md:text-base">
                  {isDrawer ? (
                    <span>You&apos;re drawing!</span>
                  ) : (
                    <span>
                      {drawerName} is now drawing! Can you guess what it is?
                    </span>
                  )}
                </p>
              </div>
            )}
          </div>
          {/* Only show timer if not in reveal phase */}
          <div className="text-center">
            {roomState.phase !== "pictionary_reveal" && (
              <Timer timer={roomState.timer} />
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Canvas */}
          <div className="lg:col-span-2">
            <div className="bg-gray-100 rounded-lg border-2 border-gray-300 p-2 sm:p-4">
              <canvas
                ref={canvasRef}
                className="w-full h-64 sm:h-96 bg-white rounded cursor-crosshair touch-none"
                onMouseDown={handleStartDraw}
                onMouseMove={handleDraw}
                onMouseUp={handleEndDraw}
                onMouseLeave={handleEndDraw}
                onTouchStart={handleStartDraw}
                onTouchMove={handleDraw}
                onTouchEnd={handleEndDraw}
                style={{ touchAction: "none" }}
              />
            </div>

            {roomState.phase === "pictionary_draw" && (
              <div className="mt-4 text-center">
                {isDrawer ? (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-blue-800 font-semibold">
                      You&apos;re drawing:{" "}
                      <span className="text-xl">{pictionary.promptFull}</span>
                    </p>
                  </div>
                ) : (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <p className="text-gray-700">
                      Drawing:{" "}
                      <span className="font-mono text-lg">
                        {pictionary.promptMasked}
                      </span>
                    </p>
                  </div>
                )}
              </div>
            )}

            {roomState.phase === "pictionary_guess" && !isDrawer && (
              <div className="mt-4">
                <form
                  onSubmit={handleGuessSubmit}
                  className="flex flex-col sm:flex-row gap-2"
                >
                  <input
                    type="text"
                    value={guessText}
                    onChange={(e) => setGuessText(e.target.value)}
                    placeholder="Enter your guess..."
                    className="flex-1 px-4 py-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 min-h-[44px]"
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="w-full sm:w-auto bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 min-h-[44px]"
                  >
                    Guess
                  </button>
                </form>
              </div>
            )}

            {roomState.phase === "pictionary_reveal" && (
              <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                <p className="text-green-800 font-semibold text-lg">
                  The word was:{" "}
                  <span className="text-xl">{pictionary.promptFull}</span>
                </p>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-4">
            {isDrawer && roomState.phase === "pictionary_reveal" && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h3 className="font-semibold mb-3 text-gray-800">
                  Pick Winners
                </h3>
                <p className="text-xs text-gray-600 mb-3">
                  Select the <strong>closest</strong> guess (2 pts) and the{" "}
                  <strong>funniest</strong> guess (1 pt)
                </p>
                <div className="space-y-2">
                  {(() => {
                    console.log("=== Rendering guesses section ===", {
                      hasGuesses: !!pictionary.guesses,
                      guessesLength: pictionary.guesses?.length || 0,
                      guesses: pictionary.guesses,
                      isDrawer,
                      phase: roomState.phase,
                      pictionaryKeys: pictionary
                        ? Object.keys(pictionary)
                        : "no pictionary",
                    });
                    return null;
                  })()}
                  {!pictionary.guesses || pictionary.guesses.length === 0 ? (
                    <p className="text-gray-600 text-sm">
                      No guesses submitted yet
                    </p>
                  ) : (
                    (() => {
                      console.log("=== About to map guesses ===", {
                        guessesArray: pictionary.guesses,
                        guessesLength: pictionary.guesses.length,
                        guessesType: typeof pictionary.guesses,
                        isArray: Array.isArray(pictionary.guesses),
                      });
                      return pictionary.guesses.map((guess, index) => {
                        console.log(`=== Mapping guess ${index} ===`, {
                          guess,
                          guessUserId: guess?.userId,
                          guessText: guess?.text,
                          guessType: typeof guess,
                        });

                        if (!guess || !guess.userId || !guess.text) {
                          console.error(
                            `Invalid guess at index ${index}:`,
                            guess
                          );
                          return null;
                        }

                        const isDummy =
                          guess.userId && guess.userId.startsWith("dummy-");
                        const player = isDummy
                          ? null
                          : roomState.players.find(
                              (p) => p.userId === guess.userId
                            );
                        const isClosest =
                          pictionary.closestWinnerId === guess.userId;
                        const isFunniest =
                          pictionary.funniestWinnerId === guess.userId;
                        const bothSelected = !!(
                          pictionary.closestWinnerId &&
                          pictionary.funniestWinnerId
                        );

                        const closestDisabled =
                          !!pictionary.closestWinnerId || isClosest;
                        const funniestDisabled =
                          !!pictionary.funniestWinnerId || isFunniest;

                        console.log(`=== Rendering guess ${index} ===`, {
                          isDummy,
                          player,
                          isClosest,
                          isFunniest,
                          bothSelected,
                          closestDisabled,
                          funniestDisabled,
                        });

                        return (
                          <div
                            key={guess.userId || Math.random()}
                            className="space-y-1"
                          >
                            <div
                              className={`w-full p-3 rounded-lg text-left border-2 ${
                                isClosest
                                  ? "bg-green-200 border-green-500"
                                  : isFunniest
                                  ? "bg-purple-200 border-purple-500"
                                  : bothSelected
                                  ? "bg-gray-100 border-gray-300"
                                  : "bg-white border-gray-300"
                              }`}
                            >
                              <div className="font-medium">
                                {isDummy ? (
                                  <span className="text-gray-400 italic">
                                    Random Guess
                                  </span>
                                ) : (
                                  player?.name || "Unknown"
                                )}
                              </div>
                              <div className="text-sm text-gray-600">
                                {guess.text || 'No guess text'}
                              </div>
                              {isClosest && (
                                <div className="text-xs text-green-700 font-semibold mt-1">
                                  ✓ Closest (2 pts)
                                </div>
                              )}
                              {isFunniest && (
                                <div className="text-xs text-purple-700 font-semibold mt-1">
                                  ✓ Funniest (1 pt)
                                </div>
                              )}
                            </div>
                            {!bothSelected && (
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    console.log(
                                      "=== Closest Button Clicked ==="
                                    );
                                    console.log("Event:", e);
                                    console.log("guess.userId:", guess.userId);
                                    console.log(
                                      "closestDisabled:",
                                      closestDisabled
                                    );
                                    console.log(
                                      "onPickWinner exists:",
                                      !!onPickWinner
                                    );
                                    console.log(
                                      "onPickWinner type:",
                                      typeof onPickWinner
                                    );
                                    console.log("bothSelected:", bothSelected);
                                    console.log(
                                      "pictionary.closestWinnerId:",
                                      pictionary.closestWinnerId
                                    );

                                    e.preventDefault();
                                    e.stopPropagation();

                                    if (!closestDisabled && onPickWinner) {
                                      console.log(
                                        "Calling onPickWinner with:",
                                        {
                                          userId: guess.userId,
                                          awardType: "closest",
                                        }
                                      );
                                      try {
                                        onPickWinner(guess.userId, "closest");
                                        console.log(
                                          "onPickWinner called successfully"
                                        );
                                      } catch (error) {
                                        console.error(
                                          "Error calling onPickWinner:",
                                          error
                                        );
                                      }
                                    } else {
                                      console.log(
                                        "NOT calling onPickWinner because:",
                                        {
                                          closestDisabled,
                                          hasOnPickWinner: !!onPickWinner,
                                        }
                                      );
                                    }
                                  }}
                                  disabled={closestDisabled}
                                  className={`flex-1 px-2 py-1 text-xs rounded border transition-colors ${
                                    closestDisabled
                                      ? "bg-gray-100 border-gray-300 text-gray-400 cursor-not-allowed"
                                      : "bg-green-100 border-green-300 text-green-700 hover:bg-green-200 cursor-pointer"
                                  }`}
                                >
                                  Closest (2pts)
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    console.log(
                                      "=== Funniest Button Clicked ==="
                                    );
                                    console.log("Event:", e);
                                    console.log("guess.userId:", guess.userId);
                                    console.log(
                                      "funniestDisabled:",
                                      funniestDisabled
                                    );
                                    console.log(
                                      "onPickWinner exists:",
                                      !!onPickWinner
                                    );
                                    console.log(
                                      "onPickWinner type:",
                                      typeof onPickWinner
                                    );
                                    console.log("bothSelected:", bothSelected);
                                    console.log(
                                      "pictionary.funniestWinnerId:",
                                      pictionary.funniestWinnerId
                                    );

                                    e.preventDefault();
                                    e.stopPropagation();

                                    if (!funniestDisabled && onPickWinner) {
                                      console.log(
                                        "Calling onPickWinner with:",
                                        {
                                          userId: guess.userId,
                                          awardType: "funniest",
                                        }
                                      );
                                      try {
                                        onPickWinner(guess.userId, "funniest");
                                        console.log(
                                          "onPickWinner called successfully"
                                        );
                                      } catch (error) {
                                        console.error(
                                          "Error calling onPickWinner:",
                                          error
                                        );
                                      }
                                    } else {
                                      console.log(
                                        "NOT calling onPickWinner because:",
                                        {
                                          funniestDisabled,
                                          hasOnPickWinner: !!onPickWinner,
                                        }
                                      );
                                    }
                                  }}
                                  disabled={funniestDisabled}
                                  className={`flex-1 px-2 py-1 text-xs rounded border transition-colors ${
                                    funniestDisabled
                                      ? "bg-gray-100 border-gray-300 text-gray-400 cursor-not-allowed"
                                      : "bg-purple-100 border-purple-300 text-purple-700 hover:bg-purple-200 cursor-pointer"
                                  }`}
                                >
                                  Funniest (1pt)
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      });
                    })()
                  )}
                </div>
              </div>
            )}

            {!isDrawer && roomState.phase === "pictionary_guess" && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-blue-800 text-sm">
                  {pictionary.guesses.find((g) => g.userId === userId)
                    ? "Guess submitted! Waiting for others..."
                    : "Submit your guess above"}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Congrats Screen - Show when both winners are selected */}
        {roomState.phase === "pictionary_reveal" &&
          pictionary.closestWinnerId &&
          pictionary.funniestWinnerId && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg shadow-2xl p-8 max-w-md mx-4 text-center">
                {/* Check if this is the last round */}
                {(() => {
                  const currentTurnIndex = pictionary.turnIndex;
                  const maxTurns = Math.min(5, pictionary.turnOrder.length);
                  const isLastRound = currentTurnIndex + 1 >= maxTurns;

                  if (isLastRound) {
                    // Last round - show winner announcement
                    const sortedPlayers = [...roomState.players].sort(
                      (a, b) => {
                        if (b.points !== a.points) return b.points - a.points;
                        return a.joinedAt - b.joinedAt;
                      }
                    );
                    const winner = sortedPlayers[0];

                    return (
                      <>
                        <h2 className="text-4xl font-bold text-pink-600 mb-6">
                          🎉 {winner?.name || "Unknown"} won!
                        </h2>
                        <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-6 mb-6">
                          <p className="text-xl font-bold text-yellow-800 mb-2">
                            {winner?.points || 0} points
                          </p>
                        </div>

                        {isHost && onRevealGender && (
                          <button
                            onClick={onRevealGender}
                            className="w-full bg-pink-600 text-white px-6 py-3 rounded-lg font-semibold text-lg hover:bg-pink-700 transition-colors"
                          >
                            Show the Baby&apos;s Gender
                          </button>
                        )}

                        {!isHost && (
                          <p className="text-gray-600 text-sm mt-4">
                            Waiting for host to reveal...
                          </p>
                        )}
                      </>
                    );
                  }

                  // Not last round - show normal round complete
                  return (
                    <>
                      <h2 className="text-3xl font-bold text-pink-600 mb-6">
                        🎉 Round Complete!
                      </h2>

                      <div className="space-y-4 mb-6">
                        {pictionary.closestWinnerId &&
                          (() => {
                            const isDummy =
                              pictionary.closestWinnerId.startsWith("dummy-");
                            const closestPlayer = isDummy
                              ? null
                              : roomState.players.find(
                                  (p) => p.userId === pictionary.closestWinnerId
                                );
                            if (isDummy) return null; // Don&apos;t show dummy winners in congrats
                            return (
                              <div className="bg-green-100 border-2 border-green-500 rounded-lg p-4">
                                <p className="text-sm text-gray-600 mb-1">
                                  Closest Guess
                                </p>
                                <p className="text-xl font-bold text-green-700">
                                  {closestPlayer?.name || "Unknown"}
                                </p>
                                <p className="text-sm text-green-600 font-semibold">
                                  +2 points
                                </p>
                              </div>
                            );
                          })()}

                        {pictionary.funniestWinnerId &&
                          (() => {
                            const isDummy =
                              pictionary.funniestWinnerId.startsWith("dummy-");
                            const funniestPlayer = isDummy
                              ? null
                              : roomState.players.find(
                                  (p) =>
                                    p.userId === pictionary.funniestWinnerId
                                );
                            if (isDummy) return null; // Don&apos;t show dummy winners in congrats
                            return (
                              <div className="bg-purple-100 border-2 border-purple-500 rounded-lg p-4">
                                <p className="text-sm text-gray-600 mb-1">
                                  Funniest Guess
                                </p>
                                <p className="text-xl font-bold text-purple-700">
                                  {funniestPlayer?.name || "Unknown"}
                                </p>
                                <p className="text-sm text-purple-600 font-semibold">
                                  +1 point
                                </p>
                              </div>
                            );
                          })()}
                      </div>

                      {isHost && onContinueToNextRound && (
                        <button
                          onClick={onContinueToNextRound}
                          className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold text-lg hover:bg-blue-700 transition-colors"
                        >
                          Continue to Next Round
                        </button>
                      )}

                      {!isHost && (
                        <p className="text-gray-600 text-sm">
                          Waiting for host to continue...
                        </p>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          )}
      </div>
    </div>
  );
}
