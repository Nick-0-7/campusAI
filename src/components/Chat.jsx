import React from "react";
import { useLocation } from "react-router-dom";

const Chat = () => {
  const location = useLocation();

  const user = location.state?.user;

  console.log(user);

  return (
    <div>
      <h1>Campus Knowledge Copilot</h1>

      <p>
        Welcome, {user?.name}
      </p>

      <p>
        Role: {user?.role}
      </p>
    </div>
  );
};

export default Chat;