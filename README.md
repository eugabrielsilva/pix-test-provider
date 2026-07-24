# PIX Test Provider

Este é um provedor de testes simples para **simular** a criação e o pagamento de cobranças via PIX. É ideal para desenvolvedores que precisam testar fluxos de checkout e webhooks sem movimentar dinheiro real.

**Projeto desenvolvido apenas para testes de pagamentos em ambiente local ou de homologação. São gerados apenas códigos PIX estáticos. Não deve ser usado em produção ou sistemas reais!**

## Instalação e configuração

Requer Node.js versão 22 ou superior.

1.  **Instale as dependências:**

    ```bash
    npm install
    ```

2.  **Configure as variáveis de ambiente:**
    Copie o arquivo `.env.example` para `.env` na raiz do projeto e configure:

    ```env
    # Porta onde rodar o servidor
    PORT=9000

    # Bearer token para autenticar nos endpoints da API
    API_TOKEN="seu_token"

    # Chave PIX de destino
    PIX_KEY="suachavepix@email.com"

    # Nome do recebedor
    PIX_NAME="Seu Nome"

    # Cidade do recebedor
    PIX_CITY="Sua Cidade"

    # URL de envio geral de eventos
    WEBHOOK_URL="http://seu-sistema.com/webhook"
    ```

3.  **Inicie o servidor:**
    ```bash
    npm start
    ```

## Endpoints

Lembre-se de enviar o header `Authorization: Bearer <API_TOKEN>` em todas as requisições com o mesmo token configurado no `.env`.

### Criar Pagamento

`POST /create`

Cria um novo pagamento e retorna os dados do PIX (Copia e Cola e QR Code).

**Corpo da requisição em JSON:**

```json
{
  "value": 1500, // valor em centavos (R$ 15,00 -> 1500)
  "expires_in": 3600, // prazo de expiração em segundos
  "description": "Pagamento de Teste", // descrição
  "notification_url": "http://localhost:9000/webhook" // URL de notificação para este pagamento
}
```

**Exemplo de resposta:**

```json
{
  "status": true,
  "data": {
    "id": "16808cb4fb684129a7ad972ef",
    "value": 1500,
    "description": "Pagamento de Teste",
    "pix_code": "00020126710014br.gov.bcb.pix0114...",
    "qr_code": "data:image/png;base64,iVBORw0KGgoAAAANSUhEU...",
    "created_at": "2026-07-22T20:30:33.616Z",
    "expires_at": "2026-07-22T20:35:33.616Z",
    "status": "PENDING",
    "notification_url": "http://localhost:9000/webhook"
  }
}
```

### Listar Pagamentos

`GET /payments`

Listar os pagamentos atuais ordenados a partir do mais recente.

**Query params:**

- `?page`: Página atual _(padrão: 1)_
- `?limit`: Limite de resultados por página _(padrão: 10)_

**Exemplo de resposta:**

```json
{
  "status": true,
  "data": [
    //payments
  ],
  "pagination": {
    "total_items": 1,
    "total_pages": 1,
    "page": 1,
    "limit": 10,
    "has_next_page": false,
    "has_previous_page": false
  }
}
```

### Consultar Pagamento

`GET /payment/:id`

Retorna os dados do pagamento e o status atual.

### Simular Pagamento

`POST /simulate/:id`

Altera o status do pagamento para `PAID` (pago) e envia uma notificação **POST** para a sua `WEBHOOK_URL` com os detalhes da transação simulando um evento de pagamento real.

Caso o pagamento tenha uma `notification_url` definida, uma notificação **POST** também será enviada para esta URL.

### Excluir Pagamento

`DELETE /delete/:id`

Exclui um pagamento.

## Créditos

Desenvolvido por [Gabriel Silva](https://github.com/eugabrielsilva).
