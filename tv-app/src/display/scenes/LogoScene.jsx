import React from "react";

// The between-slides moment: on brand purple the logo is slowly revealed.
export default function LogoScene({ tv }) {
  return (
    <div className="scene scene-logo">
      <div className="lg-lockup">
        <div className="logo-mark lg-mark" role="img" aria-label={tv.settings.shulName} />
        {tv.settings.shulNameHe && <div className="lg-he" dir="rtl">{tv.settings.shulNameHe}</div>}
      </div>
    </div>
  );
}
