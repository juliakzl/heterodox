CREATE TABLE events (
    id SERIAL PRIMARY KEY,
    event_datetime TIMESTAMP NOT NULL,
    city VARCHAR(255) NOT NULL,
    invitees TEXT[] DEFAULT '{}',
    location VARCHAR(255),
    ics_link TEXT
);