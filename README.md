# PIX Test Provider 💸

Este é um provedor de testes simples para simular a criação e o pagamento de cobranças via **PIX Estático**. É ideal para desenvolvedores que precisam testar fluxos de checkout e webhooks sem movimentar dinheiro real.

## 🚀 Como começar

1.  **Instale as dependências:**

    ```bash
    npm install
    ```

2.  **Configure as variáveis de ambiente:**
    Copie o arquivo `.env.example` para `.env` na raiz do projeto:

    ```env
    # Porta onde rodar o servidor
    PORT=9000

    # Bearer token para autenticar nos endpoints da API
    API_TOKEN="seu_token"

    # Chave PIX
    PIX_KEY="suachavepix@email.com"

    # Nome do recebedor
    PIX_NAME="Seu Nome"

    # Cidade do recebedor
    PIX_CITY="Sua Cidade"

    # URL de envio de eventos
    WEBHOOK_URL="http://seu-sistema.com/webhook"
    ```

3.  **Inicie o servidor:**
    ```bash
    npm start
    ```

## 🛠️ Endpoints da API

Lembre-se de enviar o header `Authorization: Bearer seu_token` em todas as requisições com o token configurado no `.env`.

### 1. Criar Pagamento

`POST /create`

Cria um novo pagamento e retorna os dados do PIX (Copia e Cola e QR Code em Base64).

**Corpo da requisição em JSON:**

```json
{
  "value": 1500, // valor em centavos
  "expiresIn": 3600, // prazo de expiração em segundos
  "description": "Pagamento de Teste" // descrição
}
```

### 2. Consultar Pagamento

`GET /payment/:id`

Retorna os dados do PIX (Copia e Cola e QR Code em Base64) e o status atual.

### 3. Simular Pagamento

`POST /simulate/:id`

Altera o status do pagamento para `PAID` e envia uma notificação **POST** para a sua `WEBHOOK_URL` com os detalhes da transação simulando um evento de pagamento real.
