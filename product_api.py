@app.route('/api/products', methods=['POST'])
def create_product():
    try:
        data = request.json

        # check if required fields are present
        required_fields = ['name', 'sku', 'warehouse_id']
        for field in required_fields:
            if field not in data:
                return {"error": f"Missing required field: {field}"}, 400

        # price and quantity are optional
        price = data.get('price', None)
        initial_quantity = data.get('initial_quantity', 0)

        # sku should be unique, so check before creating
        existing = Product.query.filter_by(sku=data['sku']).first()
        if existing:
            return {"error": "SKU already exists"}, 409

        product = Product(
            name=data['name'],
            sku=data['sku'],
            price=price,
            warehouse_id=data['warehouse_id']
        )
        db.session.add(product)

        inventory = Inventory(
            product_id=product.id,
            warehouse_id=data['warehouse_id'],
            quantity=initial_quantity
        )
        db.session.add(inventory)

        # single commit so both save together or neither does
        db.session.commit()

        return {
            "message": "Product created successfully",
            "product_id": product.id
        }, 201

    except Exception as e:
        db.session.rollback()
        return {"error": "Internal server error", "details": str(e)}, 500
