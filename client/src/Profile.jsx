import React, { useState, useEffect } from "react";

const Profile = () => {
  // Mock user data (replace with API call later)
  const [user, setUser] = useState({
    email: "jane.doe@example.com",
    phone: "+1 555-123-4567",
    city: "New York",
  });

  const [questions, setQuestions] = useState([
    "What is the meaning of heterodox?",
    "How do I reset my password?",
    "Can I contribute content?",
  ]);

  // Handle input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setUser({ ...user, [name]: value });
  };

  const handleSave = () => {
    // Later: Send updated data to backend
    console.log("Saving user data:", user);
  };

  return (
    <div className="profile-page" style={{ padding: "2rem" }}>
      <h2>User Profile</h2>

      {/* Personal Data Section */}
      <div className="personal-data">
        <h3>Personal Data</h3>
        <label>
          Email:
          <input
            type="email"
            name="email"
            value={user.email}
            onChange={handleChange}
          />
        </label>
        <br />
        <label>
          Phone:
          <input
            type="text"
            name="phone"
            value={user.phone}
            onChange={handleChange}
          />
        </label>
        <br />
        <label>
          City:
          <input
            type="text"
            name="city"
            value={user.city}
            onChange={handleChange}
          />
        </label>
        <br />
        <button onClick={handleSave}>Save Changes</button>
      </div>

      {/* User Questions Section */}
      <div className="user-questions" style={{ marginTop: "2rem" }}>
        <h3>Your Questions</h3>
        <ul>
          {questions.map((q, index) => (
            <li key={index}>{q}</li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default Profile;