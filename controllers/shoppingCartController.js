import jwt from "jsonwebtoken";
import Product from "../models/Product.js"; 
import ShoppingCart from "../models/ShoppingCart.js"; 
import { createOrder } from "./paypalController.js";

export const getAll = async (req, res) => {
  try {
    //traer el carrito de compras filtrado por el id del usuario
    const token = req.cookies.access_token;
    const data = jwt.verify(token, process.env.ACCESS_TOKEN_PRIVATE_KEY);
    console.log(data);
    const user_id = data.id;
    const shoppingCarts = await ShoppingCart.find({ user_id: user_id });

    res.status(200).json(shoppingCarts);
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error" });
  }
};


export const createPurchase = async (req, res) => {
  try {
    const { products } = req.body;

    const token = req.cookies.access_token;
    const data = await jwt.verify(token, process.env.ACCESS_TOKEN_PRIVATE_KEY);

    const user_id = data.id;

    let total = 0;

    // Calculate total and validate products
    for (const { product_id, quantity } of products) {
      const product = await Product.findById(product_id);
      if (!product || product.stock_quantity < quantity) {
        return res.status(400).json({
          message: "Insufficient stock for product ID: " + product_id,
        });
      }
      total += product.price * quantity;
    }

    let shoppingCart = await ShoppingCart.findOne({ user_id });
    if (!shoppingCart) {
      shoppingCart = new ShoppingCart({ user_id, products: [] });
    }

    // Comprobar si el producto ya existe en el carrito y actualizar la cantidad
    for (const { product_id, quantity } of products) {
      const existingProductIndex = shoppingCart.products.findIndex(item => item.product_id.equals(product_id));
      if (existingProductIndex !== -1) {
        shoppingCart.products[existingProductIndex].quantity += quantity;
      } else {
        shoppingCart.products.push({ product_id, quantity });
      }
    }

    shoppingCart.total = total;

    await shoppingCart.save();

    // Una vez que se haya actualizado el carrito, crea la orden de PayPal
    const paypalResponse = await createOrder(shoppingCart); // Pasar el carrito como parámetro

    return res.status(201).json({ shoppingCart });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};


export const deletePurchase = async (req, res) => {
  try {
    const deletedShoppingCart = await ShoppingCart.findByIdAndDelete(req.params.id);

    if (!deletedShoppingCart) {
      return res.status(404).json({ message: "ShoppingCart not found" });
    }

    return res.status(200).json({ message: "Delete successfuly" });
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error" });
  }
};
