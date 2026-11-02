import React from "react";

// The between-slides moment: the two homes of the minyan, side by side and given room.
export default function LogoScene({ tv }) {
  return (
    <div className="scene scene-logo">
      <div className="logo-mark lg-mark" role="img" aria-label={tv.settings.shulName} />
      <img className="lg-hillel" src={`${import.meta.env.BASE_URL}hillel.png`} alt="Hillel at UCLA" />
      {tv.settings.shulNameHe && <div className="lg-he" dir="rtl">{tv.settings.shulNameHe}</div>}
    </div>
  );
}
