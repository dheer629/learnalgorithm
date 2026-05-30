from fastapi.testclient import TestClient

from app.main import app


def test_health_endpoint_reports_ok() -> None:
    response = TestClient(app).get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_ready_endpoint_reports_structured_checks() -> None:
    response = TestClient(app).get("/api/health/ready")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] in {"ready", "not_ready"}
    assert "database" in payload["checks"]


def test_admin_sync_requires_configured_token() -> None:
    response = TestClient(app).post("/api/admin/sync")

    assert response.status_code == 503
    assert "ADMIN_TOKEN" in response.json()["detail"]


def test_visualize_endpoint_returns_trace_steps() -> None:
    response = TestClient(app).post(
        "/api/visualize",
        json={
            "code": "values = [3, 1, 2]\nfor index in range(len(values)):\n    values[index] *= 2\nprint(values)",
            "max_steps": 80,
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "completed"
    assert payload["output"].strip() == "[6, 2, 4]"
    assert payload["steps"]
    assert any(
        local["name"] == "values" and local["kind"] == "array" for step in payload["steps"] for local in step["locals"]
    )
    assert any("Trace frames captured" in line for line in payload["logs"])


def test_visualize_endpoint_reports_failure_reason() -> None:
    response = TestClient(app).post(
        "/api/visualize",
        json={"code": "items = [1]\nprint(items[5])", "max_steps": 40},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "failed"
    assert "IndexError" in payload["stderr"]
    assert any("raised an exception" in line for line in payload["logs"])
