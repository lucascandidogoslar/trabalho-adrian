# Observability Demo: NGINX + Node (metrics) + Prometheus + Grafana on Kubernetes

> Entrega pronta para a atividade:
> - Proxy reverso com NGINX (com `default.conf` e Dockerfile)
> - Comentários explicando cada arquivo
> - K8s com 4 componentes que se comunicam: **app**, **prometheus**, **grafana**, **nginx**
> - Métrica criada no `server.js` e exportada no endpoint `/metrics`
> - Dashboard do Grafana provisionado automaticamente usando essa métrica

## Estrutura

```
app/               # Node.js + prom-client (exporta /metrics)
nginx/             # Reverse proxy (roteia /api, /metrics, /grafana, /prometheus)
prometheus/        # prometheus.yml (scrape do app)
grafana/provisioning/  # datasource Prometheus e dashboard prontos
k8s/               # Manifests para o Kubernetes (namespace, deployments, services, configmaps)
```

## Como rodar

### 1) Build das imagens locais
As imagens de app e nginx são referenciadas como `:local` para facilitar testes no cluster local (kind/minikube).

```bash
# App
docker build -t node-prometheus-demo:local ./app

# NGINX
docker build -t nginx-demo:local ./nginx
```

> **Minikube**: para usar as imagens locais direto no Minikube, execute:
> ```bash
> minikube image load node-prometheus-demo:local
> minikube image load nginx-demo:local
> ```

### 2) Aplicar os manifests

```bash
kubectl apply -f k8s/00-namespace.yaml
kubectl apply -f k8s/10-app-deployment.yaml -f k8s/11-app-service.yaml
kubectl apply -f k8s/30-prometheus-configmap.yaml -f k8s/31-prometheus-deployment.yaml -f k8s/32-prometheus-service.yaml
kubectl apply -f k8s/40-grafana-dash-configmap.yaml -f k8s/41-grafana-provisioning-configmap.yaml -f k8s/42-grafana-deployment.yaml -f k8s/43-grafana-service.yaml
kubectl apply -f k8s/20-nginx-configmap.yaml -f k8s/21-nginx-deployment.yaml -f k8s/22-nginx-service.yaml
```

Aguarde os pods ficarem `Running`:
```bash
kubectl get pods -n observability-demo
```

### 3) Acessar pela NGINX (NodePort 30080)
- **Landing**: `http://$(minikube ip):30080/`
- **API**: `http://$(minikube ip):30080/api`
- **Métricas**: `http://$(minikube ip):30080/metrics`
- **Grafana**: `http://$(minikube ip):30080/grafana` (login padrão admin/admin)
- **Prometheus**: `http://$(minikube ip):30080/prometheus`

> Alternativa com `kubectl port-forward` (se não usar NodePort):
> ```bash
> kubectl -n observability-demo port-forward svc/nginx-svc 8080:80
> # depois acesse http://localhost:8080/
> ```

### 4) Gerar tráfego para ver a métrica
```bash
# Incrementa jobs_processed_total com label source=manual
curl "http://$(minikube ip):30080/api/work"

# Ou via POST para customizar a label
curl -X POST "http://$(minikube ip):30080/api/job" -H 'Content-Type: application/json' -d '{"source":"api"}'
```

Acesse o Grafana em **/grafana** → já vem com o datasource configurado e um **dashboard** chamado *Node + Prometheus Demo* com:
- `sum(jobs_processed_total)`
- `histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))`

## Observações importantes (documentação do que cada arquivo faz)

- `app/server.js`: serviço Node com **prom-client**; expõe `/metrics`; define `jobs_processed_total` (Counter) e `http_request_duration_seconds` (Histogram).  
- `nginx/default.conf`: reverse proxy que concentra rotas **/api**, **/metrics**, **/grafana**, **/prometheus**.  
- `prometheus/prometheus.yml`: configura um *scrape job* que coleta do **app-svc:3000/metrics** a cada 5s.  
- `grafana/provisioning/*`: cria automaticamente o **datasource** do Prometheus e um **dashboard** com dois painéis.  
- `k8s/*`: separa Deployments/Services/ConfigMaps por componente; **NodePort 30080** para expor a NGINX.

## Troubleshooting rápido

- Se o Grafana abrir sem dashboards, confira os logs:
  ```bash
  kubectl -n observability-demo logs deploy/grafana
  ```
- Se o Prometheus não enxergar o alvo:
  ```bash
  kubectl -n observability-demo get endpoints app-svc
  ```
- Em ambientes onde NodePort não é permitido, use `port-forward` na `nginx-svc`.