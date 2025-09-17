import React, { useState } from "react";
import bg from "./assets/bg-big.png";
import CreateEventModal from "./CreateEventModal";

const Events = () => {
  const [showUpcoming, setShowUpcoming] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const upcomingEvents = [
    { id: 1, title: "Conference on AI", date: "2025-10-01" },
    { id: 2, title: "Workshop on Ethics", date: "2025-11-15" },
  ];

  const pastEvents = [
    { id: 3, title: "Community Meetup", date: "2025-06-12" },
    { id: 4, title: "Panel Discussion", date: "2025-04-20" },
  ];

  const handleCreateEvent = () => {
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
  };

  const handleEventCreate = (eventData) => {
    console.log("Created event:", eventData);
    setShowModal(false);
  };

  const eventsToShow = showUpcoming ? upcomingEvents : pastEvents;

  return (
    <div
      style={{
        backgroundImage: `url(${bg})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        minHeight: "100vh",
        padding: "20px"
      }}
    >
      <h1>Events</h1>
      <div style={{ marginBottom: "15px" }}>
        <button onClick={() => setShowUpcoming(true)} disabled={showUpcoming}>
          Upcoming Events
        </button>
        <button onClick={() => setShowUpcoming(false)} disabled={!showUpcoming}>
          Past Events
        </button>
        <button
          onClick={handleCreateEvent}
          style={{ marginLeft: "20px", background: "green", color: "white" }}
        >
          + Create Event
        </button>
      </div>
      <ul>
        {eventsToShow.map((event) => (
          <li key={event.id}>
            <strong>{event.title}</strong> – {event.date}
          </li>
        ))}
      </ul>
      {showModal && (
        <CreateEventModal onClose={handleCloseModal} onCreate={handleEventCreate} />
      )}
    </div>
  );
};

export default Events;
