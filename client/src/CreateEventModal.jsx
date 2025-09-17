import React, { useState, useEffect } from "react";

const CreateEventModal = ({ onClose, onCreate }) => {
  const [connections, setConnections] = useState([]);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [city, setCity] = useState("");
  const [location, setLocation] = useState("");
  const [invitees, setInvitees] = useState([]);

  useEffect(() => {
    const loadConnections = async () => {
      try {
        const res1 = await fetch("/api/connections");
        const data1 = await res1.json();
        const res2 = await fetch("/api/connections/second");
        const data2 = await res2.json();
        setConnections([...(data1 || []), ...(data2 || [])]);
      } catch (err) {
        console.error("Failed to load connections", err);
      }
    };
    loadConnections();
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    const eventData = {
      title,
      date,
      time,
      city,
      location,
      invitees,
    };
    if (onCreate) onCreate(eventData);
    onClose();
  };

  const handleInviteeChange = (e) => {
    const options = Array.from(e.target.selectedOptions).map((o) => o.value);
    setInvitees(options);
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        backgroundColor: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
    >
      <div style={{ background: "#fff", padding: "20px", borderRadius: "8px", width: "400px" }}>
        <h2>Create Event</h2>
        <form onSubmit={handleSubmit}>
          <div>
            <label>Title:</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div>
            <label>Date:</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <div>
            <label>Time:</label>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
          </div>
          <div>
            <label>City:</label>
            <input value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <div>
            <label>Location:</label>
            <input value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
          <div>
            <label>Invitees:</label>
            <select multiple value={invitees} onChange={handleInviteeChange} style={{ width: "100%", height: "100px" }}>
              {connections.map((c) => (
                <option key={c.id || c.email} value={c.id}>
                  {c.name || c.email}
                </option>
              ))}
            </select>
          </div>
          <div style={{ marginTop: "15px", display: "flex", justifyContent: "flex-end" }}>
            <button type="button" onClick={onClose} style={{ marginRight: "10px" }}>
              Cancel
            </button>
            <button type="submit">Create</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateEventModal;