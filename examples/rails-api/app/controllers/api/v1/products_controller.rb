module Api
  module V1
    class ProductsController < ApplicationController
      before_action :set_product, only: [:show, :update, :destroy, :restock]

      def index
        @products = Product.all
        render json: @products
      end

      def show
        render json: @product
      end

      def create
        @product = Product.new(product_params)
        if @product.save
          render json: @product, status: :created
        else
          render json: { errors: @product.errors.full_messages }, status: :unprocessable_entity
        end
      end

      def update
        if @product.update(product_params)
          render json: @product
        else
          render json: { errors: @product.errors.full_messages }, status: :unprocessable_entity
        end
      end

      def restock
        quantity = params.require(:quantity).to_i
        @product.increment!(:stock_quantity, quantity)
        render json: @product
      end

      private

      def set_product
        @product = Product.find(params[:id])
      end

      def product_params
        params.require(:product).permit(:sku, :name, :price, :stock_quantity)
      end
    end
  end
end
