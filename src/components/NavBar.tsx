import { NavLink } from "react-router-dom";

export default function NavBar() {
  return (
    <nav style={{ display: "flex", gap: 10, marginBottom: 20 }}>
      <NavLink to="/dashboard">Dashboard</NavLink>
      <NavLink to="/journal">Journal</NavLink>
      <NavLink to="/prop-firms">Prop Firms</NavLink>
      <NavLink to="/compliance">Compliance</NavLink>
      <NavLink to="/backup">Backup</NavLink>
    </nav>
  );
}
