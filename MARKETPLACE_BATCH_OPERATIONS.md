# Marketplace Batch Operations

Este documento descreve as operações em lote implementadas para o marketplace, permitindo criar, atualizar e cancelar múltiplas listagens de uma só vez.

## Overview

As operações em lote foram implementadas para melhorar a eficiência e UX quando usuários precisam gerenciar múltiplas listagens simultaneamente. Todas as operações respeitam o limite de 100 itens por batch, conforme solicitado na issue.

## Recursos Implementados

### 1. Use Cases
- ✅ `CreateBatchListingsUseCase` - Criar múltiplas listagens
- ✅ `CancelBatchListingsUseCase` - Cancelar múltiplas listagens
- ✅ `UpdateBatchListingsUseCase` - Atualizar múltiplas listagens

### 2. DTOs
- ✅ `CreateBatchListingsDto` - Validação para criação em lote
- ✅ `CancelBatchListingsDto` - Validação para cancelamento em lote
- ✅ `UpdateBatchListingsDto` - Validação para atualização em lote

### 3. Endpoints REST
- ✅ `POST /marketplace/batch/listings` - Criar listagens em lote
- ✅ `DELETE /marketplace/batch/listings` - Cancelar listagens em lote
- ✅ `PUT /marketplace/batch/listings` - Atualizar listagens em lote

### 4. Validações e Limites
- ✅ Máximo de 100 itens por batch
- ✅ Validação de duplicatas
- ✅ Verificação de propriedade de assets
- ✅ Validação de preços e datas
- ✅ Tratamento de falhas parciais

## API Reference

### Criar Listagens em Lote

```http
POST /marketplace/batch/listings?sellerAddress=0x1234...
Content-Type: application/json

{
  "listings": [
    {
      "assetId": "asset-uuid-1",
      "price": "1000000000000000000",
      "currencyContract": "currency-uuid",
      "expiresAt": "2024-12-31T23:59:59.999Z"
    },
    {
      "assetId": "asset-uuid-2",
      "price": "2000000000000000000"
    }
  ]
}
```

**Resposta:**
```json
{
  "successCount": 1,
  "failureCount": 1,
  "created": [
    {
      "id": "listing-uuid-1",
      "assetId": "asset-uuid-1",
      "price": "1000000000000000000",
      "status": "ACTIVE",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "errors": [
    {
      "assetId": "asset-uuid-2",
      "error": "Asset already has an active sale listing"
    }
  ]
}
```

### Cancelar Listagens em Lote

```http
DELETE /marketplace/batch/listings?sellerAddress=0x1234...
Content-Type: application/json

{
  "listingIds": [
    "listing-uuid-1",
    "listing-uuid-2"
  ]
}
```

**Resposta:**
```json
{
  "successCount": 2,
  "failureCount": 0,
  "cancelledIds": [
    "listing-uuid-1",
    "listing-uuid-2"
  ],
  "errors": []
}
```

### Atualizar Listagens em Lote

```http
PUT /marketplace/batch/listings?sellerAddress=0x1234...
Content-Type: application/json

{
  "updates": [
    {
      "listingId": "listing-uuid-1",
      "price": "1500000000000000000"
    },
    {
      "listingId": "listing-uuid-2",
      "expiresAt": "2025-01-31T23:59:59.999Z"
    }
  ]
}
```

**Resposta:**
```json
{
  "successCount": 2,
  "failureCount": 0,
  "updated": [
    {
      "id": "listing-uuid-1",
      "price": "1500000000000000000",
      "updatedAt": "2024-01-01T12:00:00.000Z"
    },
    {
      "id": "listing-uuid-2",
      "expiresAt": "2025-01-31T23:59:59.999Z",
      "updatedAt": "2024-01-01T12:00:00.000Z"
    }
  ],
  "errors": []
}
```

## Validações

### Limites de Batch
- Mínimo: 1 item por batch
- Máximo: 100 itens por batch
- Sem duplicatas permitidas (asset IDs ou listing IDs)

### Validações de Negócio
- **Criação**: Asset deve existir, pertencer ao seller, ter balance > 0, não ter listing ativo
- **Cancelamento**: Listing deve existir, pertencer ao seller, estar ativo
- **Atualização**: Listing deve existir, pertencer ao seller, estar ativo

### Validações de Dados
- Endereços Ethereum válidos (regex: `^0x[a-fA-F0-9]{40}$`)
- Preços como strings numéricas positivas
- Datas ISO válidas no futuro
- UUIDs válidos para IDs

## Tratamento de Erros

As operações em lote usam "partial success" - continuam processando mesmo se alguns itens falharem. O resultado sempre inclui:

- `successCount`: Número de operações bem-sucedidas
- `failureCount`: Número de operações que falharam
- `created/updated/cancelledIds`: Dados dos itens processados com sucesso
- `errors`: Array com detalhes dos erros por item

### Códigos de Erro Comuns

| Código | Descrição |
|--------|-----------|
| `400` | Dados inválidos ou regras de negócio violadas |
| `404` | Asset ou listing não encontrado |
| `403` | Usuário não tem permissão para a operação |

## Gas Limit Considerations

O limite de 100 itens por batch foi escolhido considerando:
- Limites de gas da blockchain Ethereum
- Performance da aplicação
- UX (processamento em tempo razoável)

Para operações maiores, recomenda-se dividir em múltiplos batches.

## Testes

Testes unitários foram implementados cobrindo:
- ✅ Cenários de sucesso completo
- ✅ Falhas parciais
- ✅ Validações de entrada
- ✅ Limites de batch
- ✅ Duplicatas

Execute com:
```bash
npm test src/modules/assets/application/use-cases/__tests__/create-batch-listings.use-case.spec.ts
```

## Próximos Passos

### Melhorias Futuras
1. **Eventos Blockchain**: Expandir processamento para eventos de batch
2. **Webhooks**: Notificações para operações em lote
3. **Analytics**: Métricas de uso das operações batch
4. **Rate Limiting**: Limites por usuário/tempo

### Integração com Smart Contracts
As operações batch podem ser integradas com contratos Obelisk para:
- Reduzir custos de gas através de transações batch
- Melhorar atomicidade das operações
- Aproveitar funcionalidades nativas de batch dos contratos

## Conclusão

A implementação de operações em lote para o marketplace está completa e atende aos requisitos da issue #16:
- ✅ Funcionalidade padrão de marketplace
- ✅ Suporte a batching
- ✅ Limite máximo de 100 itens (considerando gas limit)
- ✅ Tratamento robusto de erros
- ✅ APIs bem documentadas
- ✅ Testes abrangentes