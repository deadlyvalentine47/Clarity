import { Link } from 'react-router-dom'

export default function NotFoundScreen() {
  return (
    <div className="empty">
      <div className="bold" style={{ fontSize: 20, color: 'var(--text)' }}>
        Page not found
      </div>
      <div className="small">That screen doesn&apos;t exist.</div>
      <Link className="btn btn-primary" to="/" style={{ marginTop: 8 }}>
        Go home
      </Link>
    </div>
  )
}
