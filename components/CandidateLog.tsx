"use client";

import { useEffect, useRef } from "react";

export default function CandidateLog() {
  const logged = useRef(false);

  useEffect(() => {
    if (!logged.current) {
      console.log("[Py] Candidate LinkedIn: https://www.linkedin.com/in/srishti-singh-6a589928a/");
      logged.current = true;
    }
  }, []);

  return null;
}
