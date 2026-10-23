import React, { useState, useRef, useEffect, useCallback } from "react";
import { Box, Group, Text, Loader, Paper } from "@mantine/core";
import { IconArrowDown, IconArrowUp, IconCheck } from "@tabler/icons-react";

export interface PullToRefreshProps {
  onRefresh: () => Promise<void> | void;
  children: React.ReactNode;
  disabled?: boolean;
  pullThreshold?: number;
  maxPullDistance?: number;
  restingHeight?: number;
}

type PullStatus = "idle" | "pulling" | "canRelease" | "refreshing" | "complete";

export const PullToRefresh: React.FC<PullToRefreshProps> = ({
  onRefresh,
  children,
  disabled = false,
  pullThreshold = 60,
  maxPullDistance = 95,
  restingHeight = 48,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [status, setStatus] = useState<PullStatus>("idle");

  const startYRef = useRef(0);
  const startXRef = useRef(0);
  const isPullingRef = useRef(false);
  const isCandidateRef = useRef(false);
  const didPullRef = useRef(false);
  const statusRef = useRef<PullStatus>("idle");
  statusRef.current = status;

  // Helper to find the active scrolling viewport element
  const getScrollContainer = useCallback((): HTMLElement | null => {
    if (!containerRef.current) return null;
    return (
      containerRef.current.querySelector<HTMLElement>(".mantine-ScrollArea-viewport") ||
      containerRef.current.querySelector<HTMLElement>("[data-radix-scroll-area-viewport]") ||
      containerRef.current.querySelector<HTMLElement>("[data-scrollable]") ||
      containerRef.current
    );
  }, []);

  const handleStart = useCallback((clientX: number, clientY: number) => {
    if (disabled || statusRef.current === "refreshing" || statusRef.current === "complete") return;

    const scrollEl = getScrollContainer();
    const scrollTop = scrollEl ? scrollEl.scrollTop : 0;

    // Only allow pull-down if user is scrolled to the very top (scrollTop <= 2px)
    if (scrollTop <= 2) {
      startYRef.current = clientY;
      startXRef.current = clientX;
      isCandidateRef.current = true;
      isPullingRef.current = false;
      didPullRef.current = false;
    } else {
      isCandidateRef.current = false;
    }
  }, [disabled, getScrollContainer]);

  const handleMove = useCallback((clientX: number, clientY: number, cancelable: boolean, preventDefault: () => void) => {
    if (!isCandidateRef.current || disabled || statusRef.current === "refreshing" || statusRef.current === "complete") {
      return;
    }

    const scrollEl = getScrollContainer();
    const scrollTop = scrollEl ? scrollEl.scrollTop : 0;
    if (scrollTop > 2) {
      isCandidateRef.current = false;
      isPullingRef.current = false;
      setPullDistance(0);
      setStatus("idle");
      return;
    }

    const deltaY = clientY - startYRef.current;
    const deltaX = clientX - startXRef.current;

    // If user is scrolling downwards through the list (finger moving up, deltaY < 0),
    // immediately disarm candidate so native WebKit scrolling proceeds with full momentum!
    if (deltaY < 0) {
      isCandidateRef.current = false;
      isPullingRef.current = false;
      return;
    }

    // If movement is predominantly horizontal, ignore (don't interfere with swipe)
    if (!isPullingRef.current && Math.abs(deltaX) > Math.abs(deltaY)) {
      isCandidateRef.current = false;
      return;
    }

    if (deltaY > 0) {
      // User is dragging downwards while at top of scroll
      isPullingRef.current = true;
      if (deltaY > 6) {
        didPullRef.current = true;
      }

      if (cancelable) {
        preventDefault();
      }

      // Elastic rubber-band friction formula
      const friction = 0.45;
      const calculatedDistance = Math.min(deltaY * friction, maxPullDistance);
      setPullDistance(calculatedDistance);

      if (calculatedDistance >= pullThreshold) {
        setStatus("canRelease");
      } else {
        setStatus("pulling");
      }
    } else if (isPullingRef.current) {
      // Dragging upwards back to top
      setPullDistance(0);
      setStatus("idle");
      isPullingRef.current = false;
    }
  }, [disabled, getScrollContainer, maxPullDistance, pullThreshold]);

  const handleEnd = useCallback(async () => {
    if (!isCandidateRef.current && !isPullingRef.current) return;
    isCandidateRef.current = false;
    isPullingRef.current = false;

    if (statusRef.current === "canRelease") {
      // Trigger refresh
      setStatus("refreshing");
      setPullDistance(restingHeight);

      try {
        await Promise.resolve(onRefresh());
        setStatus("complete");
      } catch (e) {
        console.error("Pull to refresh error:", e);
        setStatus("idle");
        setPullDistance(0);
        return;
      }

      // Show completed checkmark briefly before smoothly collapsing
      setTimeout(() => {
        setPullDistance(0);
        setTimeout(() => {
          setStatus("idle");
          didPullRef.current = false;
        }, 300);
      }, 400);
    } else {
      // Released before threshold, snap back
      setPullDistance(0);
      setStatus("idle");
      setTimeout(() => {
        didPullRef.current = false;
      }, 50);
    }
  }, [onRefresh, restingHeight]);

  // Native non-passive touch listeners for mobile overscroll control
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onTouchStartNative = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        handleStart(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    const onTouchMoveNative = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        handleMove(
          e.touches[0].clientX,
          e.touches[0].clientY,
          e.cancelable,
          () => e.preventDefault()
        );
      }
    };

    const onTouchEndNative = () => handleEnd();

    el.addEventListener("touchstart", onTouchStartNative, { passive: true });
    el.addEventListener("touchmove", onTouchMoveNative, { passive: false });
    el.addEventListener("touchend", onTouchEndNative, { passive: true });
    el.addEventListener("touchcancel", onTouchEndNative, { passive: true });

    return () => {
      el.removeEventListener("touchstart", onTouchStartNative);
      el.removeEventListener("touchmove", onTouchMoveNative);
      el.removeEventListener("touchend", onTouchEndNative);
      el.removeEventListener("touchcancel", onTouchEndNative);
    };
  }, [handleStart, handleMove, handleEnd]);

  // Mouse event listeners (allows desktop drag-to-refresh)
  const isMouseDownRef = useRef(false);

  const onMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      isMouseDownRef.current = true;
      handleStart(e.clientX, e.clientY);
    }
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (isMouseDownRef.current) {
      handleMove(e.clientX, e.clientY, false, () => {});
    }
  };

  const onMouseUp = () => {
    if (isMouseDownRef.current) {
      isMouseDownRef.current = false;
      handleEnd();
    }
  };

  const onMouseLeave = () => {
    if (isMouseDownRef.current) {
      isMouseDownRef.current = false;
      handleEnd();
    }
  };

  // Prevent accidental card selection when pulling down
  const handleClickCapture = (e: React.MouseEvent) => {
    if (didPullRef.current) {
      e.stopPropagation();
      e.preventDefault();
      setTimeout(() => {
        didPullRef.current = false;
      }, 50);
    }
  };

  // Calculate rotation for pulling arrow
  const arrowRotation = status === "canRelease"
    ? 180
    : Math.min(180, (pullDistance / pullThreshold) * 180);

  const isTransitioning = status === "idle" || status === "refreshing" || status === "complete";

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
      onClickCapture={handleClickCapture}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
    >
      {/* PULL DOWN REFRESH INDICATOR HEADER */}
      <Box
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: pullDistance,
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 10,
          pointerEvents: "none",
          transition: isTransitioning ? "height 0.28s cubic-bezier(0.2, 0.9, 0.3, 1)" : "none",
        }}
      >
        {pullDistance > 10 && (
          <Paper
            withBorder
            radius="xl"
            px={14}
            py={6}
            bg="#ffffff"
            style={{
              boxShadow: "0 4px 14px rgba(12, 166, 120, 0.15)",
              border: status === "canRelease" || status === "refreshing" ? "1.5px solid #20c997" : "1px solid #dee2e6",
              transform: `scale(${Math.min(1, Math.max(0.7, pullDistance / pullThreshold))})`,
              transition: "transform 0.15s ease, border-color 0.15s ease",
            }}
          >
            <Group gap={8} wrap="nowrap">
              {status === "refreshing" ? (
                <Loader size={16} color="teal" />
              ) : status === "complete" ? (
                <IconCheck size={16} color="#0ca678" stroke={2.5} />
              ) : status === "canRelease" ? (
                <IconArrowUp size={16} color="#0ca678" stroke={2.5} />
              ) : (
                <Box
                  style={{
                    display: "flex",
                    alignItems: "center",
                    transform: `rotate(${arrowRotation}deg)`,
                    transition: "transform 0.1s linear",
                  }}
                >
                  <IconArrowDown size={16} color="#495057" stroke={2} />
                </Box>
              )}

              <Text
                size="xs"
                fw={600}
                c={
                  status === "complete" || status === "refreshing" || status === "canRelease"
                    ? "teal.9"
                    : "dimmed"
                }
                style={{ userSelect: "none" }}
              >
                {status === "refreshing"
                  ? "Checking for new emails..."
                  : status === "complete"
                  ? "Up to date"
                  : status === "canRelease"
                  ? "Release to refresh"
                  : "Pull down to refresh"}
              </Text>
            </Group>
          </Paper>
        )}
      </Box>

      {/* INNER CONTENT CONTAINER (TRANSLATES DOWN AS YOU PULL) */}
      <Box
        style={{
          flex: 1,
          height: "100%",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          transform: `translateY(${pullDistance}px)`,
          transition: isTransitioning ? "transform 0.28s cubic-bezier(0.2, 0.9, 0.3, 1)" : "none",
          willChange: pullDistance > 0 ? "transform" : "auto",
        }}
      >
        {children}
      </Box>
    </div>
  );
};
