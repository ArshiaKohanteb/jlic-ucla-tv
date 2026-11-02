import React, { useState } from "react";
import { Images, Camera } from "lucide-react";
import { Tabs } from "../ui.jsx";
import Flyers from "./Flyers.jsx";
import Photos from "./Photos.jsx";

export default function Media(props) {
  const [tab, setTab] = useState("flyers");
  return (
    <div className="stack">
      <Tabs value={tab} onChange={setTab} options={[
        { value: "flyers", label: "Flyers", icon: Images },
        { value: "photos", label: "Community photos", icon: Camera },
      ]} />
      {tab === "flyers" ? <Flyers {...props} /> : <Photos {...props} />}
    </div>
  );
}
