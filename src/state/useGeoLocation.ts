import { useCallback, useEffect, useRef, useState } from "react";

type GeoErrorCode = 1 | 2 | 3; // 1=PERMISSION_DENIED, 2=POSITION_UNAVAILABLE, 3=TIMEOUT

type GeoState =
  | { status: "off"; lonLat: null; accuracyM: null; error: null; errorCode: null }
  | { status: "loading"; lonLat: null; accuracyM: null; error: null; errorCode: null }
  | { status: "on"; lonLat: [number, number]; accuracyM: number | null; error: string | null; errorCode: GeoErrorCode | null }
  | { status: "error"; lonLat: null; accuracyM: null; error: string; errorCode: GeoErrorCode | null };

function isTransientError(code: number | null | undefined) {
  return code === 2 || code === 3; // POSITION_UNAVAILABLE oder TIMEOUT
}

export function useGeoLocation() {
  const [state, setState] = useState<GeoState>({
    status: "off",
    lonLat: null,
    accuracyM: null,
    error: null,
    errorCode: null,
  });

  const watchIdRef = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setState({ status: "off", lonLat: null, accuracyM: null, error: null, errorCode: null });
  }, []);

  const start = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setState({
        status: "error",
        lonLat: null,
        accuracyM: null,
        error: "Geolocation nicht verfügbar.",
        errorCode: null,
      });
      return;
    }

    // wenn schon watch läuft -> reset
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    setState({ status: "loading", lonLat: null, accuracyM: null, error: null, errorCode: null });

    const options: PositionOptions = {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 15000,
    };

    const onPos = (pos: GeolocationPosition) => {
      const lon = pos.coords.longitude;
      const lat = pos.coords.latitude;
      const acc = typeof pos.coords.accuracy === "number" ? pos.coords.accuracy : null;

      setState({
        status: "on",
        lonLat: [lon, lat],
        accuracyM: acc,
        error: null,
        errorCode: null,
      });
    };

    const onErr = (err: GeolocationPositionError) => {
      const code = err.code as GeoErrorCode;

      // ✅ Wenn wir schon eine Position haben und es nur TIMEOUT/UNAVAILABLE ist:
      // -> NICHT ausschalten, nur Warnung setzen
      setState((prev) => {
        if (prev.status === "on" && prev.lonLat && isTransientError(code)) {
          return {
            ...prev,
            error: err.message || "Standort kurz nicht verfügbar.",
            errorCode: code,
          };
        }

        // ❌ fatal (oder noch keine Position)
        return {
          status: "error",
          lonLat: null,
          accuracyM: null,
          error: err.message || "Standort nicht verfügbar.",
          errorCode: code,
        };
      });

      // Nur bei fatal errors Watch beenden
      if (code === 1) {
        if (watchIdRef.current != null) {
          navigator.geolocation.clearWatch(watchIdRef.current);
          watchIdRef.current = null;
        }
      }
    };

    // 1) initialer Prompt/Position
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onPos(pos);

        // 2) watch updates
        watchIdRef.current = navigator.geolocation.watchPosition(onPos, onErr, options);
      },
      onErr,
      options
    );
  }, []);

  useEffect(() => {
    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, []);

  return {
    state,
    start,
    stop,
    enabled: state.status === "loading" || state.status === "on",
  };
}
